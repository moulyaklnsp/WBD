<!--
STEP 1 - AUDIT EXISTING APIs (search/filter/sort/list/pagination)
Generated: 2026-04-18

Roles (observed): admin, organizer, coordinator, player
Route guards (observed from `backend/src/app.js`):
- /admin/*       -> isAdmin
- /organizer/*   -> isOrganizer
- /coordinator/* -> isCoordinator
- /player/*      -> isPlayer
- everything else: unguarded unless controller/service checks session

Format per endpoint:
METHOD PATH | roles | query params | db filters (exact/fulltext/range) | sort/limit/page | redis cache key | controller -> service | tests

========================
PUBLIC / CROSS-ROLE
========================

GET /api/users | roles=public | query=role,search | exact=users.role; fulltext=users.$text(search) | sort=(search? textScore desc : name/email asc); limit=200 | redis=Cache.keys.usersSearch({role,q}) tags=[users] | userController.getUsers (direct DB) | tests=none
GET /api/chat/history | roles=public | query=room | exact=chat_messages.room | sort=timestamp desc; limit=50 | redis=none | chatController.getHistory -> chatService.getHistory | tests=none
GET /api/chat/contacts | roles=public | query=username(required) | exact=chat_messages.participants/sender/receiver == username OR room=='global' | sort=timestamp desc; cap=2000 pre-group | redis=none | chatController.getContacts -> chatService.getContacts | tests=none

GET /api/public/coordinator-blogs | roles=public | query=none | exact=blogs.status=='published' OR blogs.published==true | sort=published_at/updated_date/created_date desc | redis=Cache.keys.blogsPublished() tags=[blogs] | coordinatorController.getPublishedBlogsPublic -> coordinator/blogsService.getPublishedBlogsPublic | tests=tests/api/publicBlogs.cache.test.js; tests/controllers/coordinatorController.test.js; tests/services/coordinator/blogsService.test.js
GET /api/public/coordinator-blogs/:id | roles=public(+optional owner session) | query=none | exact=blogs._id; auth=unpublished only for owner coordinator | sort=n/a | redis=Cache.keys.blogPublic(id) tags=[blogs] cacheWhen=published | coordinatorController.getBlogByIdPublic -> coordinator/blogsService.getBlogByIdPublic | tests=tests/api/publicBlogDetail.cache.test.js; tests/controllers/coordinatorController.test.js
GET /api/public/coordinator-blogs/:id/reviews | roles=public | query=none | exact=blog_reviews.blog_id | sort=created_at desc | redis=Cache.keys.blogReviews(id) tags=[blogs] | coordinatorController.getBlogReviews -> coordinator/blogsService.getBlogReviews | tests=tests/controllers/coordinatorController.test.js
POST /api/public/coordinator-blogs/:id/reviews | roles=public(+optional session attribution) | query=none | write=blog_reviews.insert; invalidates tags=[blogs] | redis=invalidate only | coordinatorController.addBlogReview -> coordinator/blogsService.addBlogReview | tests=tests/controllers/coordinatorController.test.js

GET /api/contactus/my | roles=session.userEmail required | query=none | exact=contact.submitted_by==me OR contact.email==me | sort=submission_date desc; limit=200 | redis=none | authController.getMyContactQueries -> authApiService.getMyContactQueries | tests=controllers/authController.test.js (no targeted case found)

========================
ADMIN (/admin/*)
========================

GET /admin/api/dashboard | roles=admin | query=none | range=meetingsdb.date<=today+3d; exact=meetingsdb.role=='admin' | sort=meetings date/time asc; contact submission_date desc | redis=none | adminController.getDashboard (direct DB) | tests=none
GET /admin/api/contact | roles=admin | query=status,search | exact=contact.status; fulltext=contact.$text(search) | sort=(search? textScore desc + submission_date desc : submission_date desc); limit=200 | redis=none | adminController.getContactMessages (direct DB) | tests=none
GET /admin/api/tournaments | roles=admin | query=none | exact=tournaments.status!='Removed' | sort=date desc | redis=none | adminController.getTournaments (direct DB) | tests=none
GET /admin/api/tournaments/:id/details | roles=admin | query=none | exact=tournaments._id; list=players via tournament_players + enrolledtournaments_team | sort=n/a | redis=none | adminController.getTournamentDetails -> admin/adminService.getTournamentDetails | tests=none

GET /admin/api/coordinators | roles=admin | query=limit,skip,page,pageSize | exact=users.role=='coordinator' | sort=name/email asc; paged | redis=none | adminController.getCoordinators -> admin/adminService.getCoordinators | tests=none
GET /admin/api/organizers | roles=admin | query=limit,skip,page,pageSize | exact=users.role=='organizer' | sort=name/email asc; paged | redis=none | adminController.getOrganizers -> admin/adminService.getOrganizers | tests=none
GET /admin/api/players | roles=admin | query=limit,skip,page,pageSize | exact=users.role=='player' | sort=name/email asc; paged | redis=none | adminController.getPlayers -> admin/adminService.getPlayers | tests=none

GET /admin/api/payments | roles=admin | query=startDate,endDate,college,coordinator,limit,skip,page,pageSize | range=createdAt/start_date/date/purchase_date; exact=college_key/coordinator_key | sort=date desc per facet; paged per facet | redis=none | adminController.getPayments (direct DB) | tests=none

GET /admin/api/organizers/:email/details | roles=admin | query=none | exact=organizer email; list=tournaments+meetings via identity keys | sort=tournaments date/start_date desc; meetings date/time desc; limit=500 | redis=none | adminController.getOrganizerDetails (direct DB) | tests=none
GET /admin/api/coordinators/:email/details | roles=admin | query=limit/pageSize/page (salesLimit only) | exact=users.email+role; list=students/tournaments/meetings/sales | sort=students name asc; tournaments date desc; meetings date/time desc; sales purchase_date desc; limits=500/500/500/salesLimit | redis=none | adminController.getCoordinatorDetails -> admin/adminService.getCoordinatorDetails | tests=none
GET /admin/api/players/:email/details | roles=admin | query=none | exact=users.email+role; list=topups/subscriptions/sales/participation | sort=topups createdAt desc; subscriptions _id desc; sales purchase_date desc; limit=500 | redis=none | adminController.getPlayerDetails -> admin/adminService.getPlayerDetails | tests=none

GET /admin/api/analytics/organizers | roles=admin | query=none | exact=users.role=='organizer' AND !isDeleted; aggregates approvals/rejections/meetings | sort=decisions desc, approvedCount desc, name asc | redis=none | adminController.getOrganizerAnalytics -> admin/adminService.getOrganizerAnalytics | tests=none
GET /admin/api/analytics/growth | roles=admin | query=range | range=bucketed tournaments/sales by createdAt | sort=bucket order asc | redis=none | adminController.getGrowthAnalytics -> admin/adminService.getGrowthAnalytics | tests=none

========================
ORGANIZER (/organizer/*)
========================

GET /organizer/api/dashboard | roles=organizer | query=none | range=meetings date today..today+3d; exact=tournaments.status=='Pending'; exact=pending_coordinators.status=='pending' | sort=meetings date/time asc; pendingApprovals date asc; pendingCoordinators created_at desc limit=200 | redis=none | organizerController.getDashboard -> organizer/analyticsService.getDashboard | tests=tests/controllers/organizerController.test.js; tests/services/organizer/analyticsService.test.js
GET /organizer/api/coordinators | roles=organizer | query=none | exact=users.role=='coordinator' | sort=none specified | redis=none | organizerController.getCoordinators -> organizer/usersService.listCoordinators | tests=tests/controllers/organizerController.test.js; tests/services/organizer/usersService.test.js
GET /organizer/api/coordinators/pending | roles=organizer | query=none | exact=pending_coordinators.status=='pending' | sort=created_at desc; limit=200 | redis=none | organizerController.getPendingCoordinators -> organizer/usersService.listPendingCoordinators | tests=tests/controllers/organizerController.test.js
GET /organizer/api/tournaments | roles=organizer | query=none | list=tournaments(all) | sort=date desc | redis=none | organizerController.getTournaments -> organizer/tournamentsService.listTournaments | tests=tests/controllers/organizerController.test.js
GET /organizer/api/store | roles=organizer | query=sortBy,order,limit,skip,page,pageSize | list=products+sales | sort=products(sortBy allowlist); sales purchase_date desc; paged | redis=none | organizerController.getStore -> organizer/analyticsService.getStoreSummary | tests=tests/controllers/organizerController.test.js (no dedicated getStoreSummary test found)
GET /organizer/api/meetings/organized | roles=organizer | query=none | exact=meetingsdb.role=='organizer' AND name==me | sort=date/time asc | redis=none | organizerController.getOrganizedMeetings -> organizer/meetingsService.getOrganizedMeetings | tests=tests/controllers/organizerController.test.js
GET /organizer/api/meetings/upcoming | roles=organizer | query=none | range=meetingsdb.date>=today; exact=name!=me | sort=date/time asc | redis=none | organizerController.getUpcomingMeetings -> organizer/meetingsService.getUpcomingMeetings | tests=tests/controllers/organizerController.test.js

GET /organizer/api/sales/monthly | roles=organizer | query=month | range=sales.purchase_date within month window | sort=day asc | redis=none | organizerController.getMonthlySales -> organizer/salesService.getMonthlySales | tests=tests/controllers/organizerController.test.js
GET /organizer/api/sales/yearly | roles=organizer | query=none | range=sales.purchase_date within current year | sort=month 1..12 | redis=none | organizerController.getYearlySales -> organizer/salesService.getYearlySales | tests=tests/controllers/organizerController.test.js
GET /organizer/api/sales/tournament-revenue | roles=organizer | query=none | exact=tournaments.status in [Approved,Ongoing,Completed] | sort=tournaments date desc; series key asc | redis=none | organizerController.getTournamentRevenue -> organizer/analyticsService.getTournamentRevenue | tests=tests/controllers/organizerController.test.js
GET /organizer/api/sales/store-revenue | roles=organizer | query=none | aggregates=sales totals/monthly/yearly/product | sort=product revenue desc; series key asc | redis=none | organizerController.getStoreRevenue -> organizer/salesService.getStoreRevenue | tests=tests/controllers/organizerController.test.js
GET /organizer/api/sales/insights | roles=organizer | query=none | aggregates=sales grouped by month | sort=month key asc | redis=none | organizerController.getRevenueInsights -> organizer/salesService.getRevenueInsights | tests=tests/controllers/organizerController.test.js

GET /organizer/api/coordinator-performance | roles=organizer | query=none | aggregates=coordinator performance (store+tournaments+meetings) | sort=service-defined | redis=none | organizerController.getCoordinatorPerformance -> organizer/analyticsService.getCoordinatorPerformance | tests=tests/controllers/organizerController.test.js
GET /organizer/api/growth-analysis | roles=organizer | query=none | aggregates=platform growth | sort=month series asc | redis=none | organizerController.getGrowthAnalysis -> organizer/analyticsService.getGrowthAnalysis | tests=tests/controllers/organizerController.test.js; tests/services/organizer/analyticsService.test.js

========================
COORDINATOR (/coordinator/*)
========================

GET /coordinator/api/streams | roles=coordinator | query=none | exact=streams.createdByEmail==me | sort=updatedAt/createdAt desc | redis=none | coordinatorController.getStreams -> coordinator/streamsService.getStreams | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/notifications | roles=coordinator | query=none | exact=notifications.user_id==me | sort=date desc limit=50 | redis=none | coordinatorController.getNotifications -> coordinator/notificationsService.getNotifications | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/tournaments | roles=coordinator | query=none | exact=tournaments.coordinator==me | sort=date desc | redis=none | coordinatorController.getTournaments -> coordinator/tournamentsService.getTournaments | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/tournamentsService.test.js
GET /coordinator/api/tournaments/:id/files | roles=coordinator (ownership enforced) | query=none | exact=tournament_files.tournament_id | sort=upload_date desc | redis=none | coordinatorController.getTournamentFiles -> coordinator/tournamentsService.getTournamentFiles | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/tournamentsService.test.js

GET /coordinator/api/calendar | roles=coordinator | query=year,month,all,limit,skip,page,pageSize | range=date month window; exact=ownership by coordinator identifiers; union=tournaments+meetingsdb+announcements+chess_events+calendar_events | sort=date/time/source asc; paged | redis=none | coordinatorController.getCalendarEvents -> coordinator/calendarService.getCalendarEvents | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/calendarService.test.js
GET /coordinator/api/meetings/organized | roles=coordinator | query=none | exact=meetingsdb.role=='coordinator' AND name==me; exclude=source=='calendar' | sort=date/time asc | redis=none | coordinatorController.getOrganizedMeetings -> coordinator/meetingsService.getOrganizedMeetings | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/meetings/upcoming | roles=coordinator | query=none | range=date today..today+3d; exact=name!=me; exclude=source=='calendar' | sort=date/time asc | redis=none | coordinatorController.getUpcomingMeetings -> coordinator/meetingsService.getUpcomingMeetings | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/meetings/received | roles=coordinator | query=none | exact=meetingsdb.role=='coordinator' AND name==myEmail | sort=date/time desc | redis=none | coordinatorController.getReceivedMeetings -> coordinator/meetingsService.getReceivedMeetings | tests=tests/controllers/coordinatorController.test.js

GET /coordinator/api/complaints | roles=coordinator | query=none | list=union tournament_complaints + complaints | sort=createdAt desc | redis=none | coordinatorController.getComplaints -> coordinator/complaintsService.getComplaints | tests=tests/controllers/coordinatorController.test.js

GET /coordinator/api/store/products | roles=coordinator | query=available,limit,skip,page,pageSize | exact=products.college==myCollege; range=availability>0? | sort=added_date/_id desc; paged | redis=none | coordinatorController.getProducts -> coordinator/storeService.getProducts | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/storeService.test.js
GET /coordinator/api/store/orders | roles=coordinator (implicit by owned products) | query=none | filter=orders containing coordinator-owned productIds | sort=createdAt desc | redis=none | coordinatorController.getOrders -> coordinator/storeService.getOrders | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/storeService.test.js
GET /coordinator/api/store/analytics | roles=coordinator (implicit by owned products) | query=none | aggregates=sales mostSold/monthlyRevenue(12)/productRevenue/customerLogs | sort=service-defined | redis=none | coordinatorController.getOrderAnalytics -> coordinator/storeService.getOrderAnalytics | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/store/analytics/products/:productId | roles=coordinator (ownership enforced) | query=none | aggregates=orders+sales grouped by day | sort=date asc | redis=none | coordinatorController.getProductAnalyticsDetails -> coordinator/storeService.getProductAnalyticsDetails | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/store/reviews | roles=coordinator | query=productId | exact=reviews.product_id | sort=created_at/updated_at desc | redis=none | coordinatorController.getProductReviews -> coordinator/storeService.getProductReviews | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/store/complaints | roles=coordinator (implicit by owned products) | query=limit,skip,page,pageSize | filter=complaints joined to products where coordinator matches | sort=submitted_date desc; paged | redis=none | coordinatorController.getOrderComplaints -> coordinator/storeService.getOrderComplaints | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/storeService.test.js

GET /coordinator/api/blogs | roles=coordinator | query=none | exact=blogs.coordinator==myEmail | sort=created_date desc | redis=none | coordinatorController.getBlogs -> coordinator/blogsService.getBlogs | tests=tests/controllers/coordinatorController.test.js; tests/services/coordinator/blogsService.test.js
GET /coordinator/api/blogs/public | roles=coordinator (route lives under /coordinator) | query=none | same as GET /api/public/coordinator-blogs | sort=published_at/updated_date/created_date desc | redis=Cache.keys.blogsPublished() tags=[blogs] | coordinatorController.getPublishedBlogsPublic -> coordinator/blogsService.getPublishedBlogsPublic | tests=tests/controllers/coordinatorController.test.js

GET /coordinator/api/player-stats | roles=coordinator | query=none | exact=users.role=='player'; lookup=player_stats | sort=rating desc, name asc | redis=none | coordinatorController.getPlayerStats -> coordinator/playerStatsService.getPlayerStats | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/enrolled-players | roles=coordinator | query=tournament_id|tournamentId | exact=enrollment tournament_id | sort=service-defined | redis=none | coordinatorController.getEnrolledPlayers -> coordinator/playerStatsService.getEnrolledPlayers | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/pairings | roles=coordinator | query=tournament_id|tournamentId,rounds | exact=tournament_players.tournament_id | sort=derived by swiss pairing | redis=none | coordinatorController.getPairings -> coordinator/pairingsService.getPairings | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/rankings | roles=coordinator | query=tournament_id|tournamentId | derived=rankings by score desc | sort=computed | redis=none | coordinatorController.getRankings -> coordinator/pairingsService.getRankings | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/team-pairings | roles=coordinator | query=tournament_id|tournamentId,rounds | derived=team pairings | sort=computed | redis=none | coordinatorController.getTeamPairings -> coordinator/pairingsService.getTeamPairings | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/team-rankings | roles=coordinator | query=tournament_id|tournamentId | derived=team rankings | sort=computed | redis=none | coordinatorController.getTeamRankings -> coordinator/pairingsService.getTeamRankings | tests=tests/controllers/coordinatorController.test.js

GET /coordinator/api/feedbacks | roles=coordinator | query=tournament_id|tournamentId | exact=feedbacks.tournament_id | sort=none specified | redis=none | coordinatorController.getFeedbacks -> coordinator/feedbackService.getFeedbacks | tests=tests/controllers/coordinatorController.test.js
GET /coordinator/api/chess-events | roles=coordinator | query=none | exact=chess_events.coordinatorId==session.userId | sort=date asc | redis=none | coordinatorController.getChessEvents -> coordinator/chessEventsService.getChessEvents | tests=tests/controllers/coordinatorController.test.js

========================
PLAYER (/player/*)
========================

GET /player/api/dashboard | roles=player | query=none | aggregates=dashboard (service-defined) | sort=service-defined | redis=none | playerController.getDashboard -> player/dashboardService.getDashboard | tests=tests/controllers/playerController.test.js
GET /player/api/tournaments | roles=player | query=none | exact=tournaments.status=='Approved' (+enrollment lookups) | sort=service-defined | redis=Cache.keys.tournamentsApproved() tags=[tournaments] | playerController.getTournaments -> player/tournamentsService.getTournaments | tests=tests/controllers/playerController.test.js; tests/services/player/tournamentsService.test.js
GET /player/api/tournament-calendar | roles=player | query=none | exact=tournaments.status in [Approved,Ongoing] | sort=date asc | redis=none | playerController.getTournamentCalendar -> player/tournamentsService.getTournamentCalendar | tests=tests/controllers/playerController.test.js

GET /player/api/store | roles=player | query=available,q|search,sortBy|sort|orderBy,order|direction,limit,skip,page,pageSize | range=availability>0?; fulltext=products.$text(q/search) | sort=allowlist(name,price,availability) else _id desc; paged | redis=none | playerController.getStore -> player/storeService.getStore | tests=tests/controllers/playerController.test.js (no dedicated storeService.getStore test found)
GET /player/api/store/suggestions | roles=player | query=none | aggregates=mostOrdered(sales group count desc limit 5)+suggested(limit 5) | sort=mostOrdered count desc | redis=Cache.keys.storeSuggestionsByUser(email) tags=[store] (service also caches Cache.keys.storeMostOrdered()) | playerController.getStoreSuggestions -> player/storeService.getStoreSuggestions | tests=tests/api/storeSuggestions.cache.test.js
GET /player/api/reviews/:productId | roles=player | query=productId(path) | exact=reviews.product_id | sort=created_at/updated_at desc | redis=none | playerController.getProductReviews -> player/storeService.getProductReviews | tests=tests/controllers/playerController.test.js

GET /player/api/subscription/history | roles=player | query=none | exact=subscription_history.user_email==me | sort=date desc | redis=none | playerController.getSubscriptionHistory -> player/subscriptionService.getSubscriptionHistory | tests=tests/controllers/playerController.test.js
GET /player/api/growth | roles=player | query=none | exact=player_stats.player_id==me; optional=rating_history | sort=service-defined | redis=none | playerController.getGrowth -> player/growthService.getGrowth | tests=tests/controllers/playerController.test.js; tests/services/player/growthService.test.js
GET /player/api/growth_analytics | roles=player | query=none | aggregates=player growth series | sort=service-defined | redis=none | playerController.getGrowthAnalytics -> player/growthService.getGrowthAnalytics | tests=tests/controllers/playerController.test.js; tests/services/player/growthService.test.js
GET /player/api/compare | roles=player | query=opponent|query(required) | exact=users.email==search OR users.name==search | sort=n/a | redis=none | playerController.comparePlayer -> player/growthService.comparePlayer | tests=tests/controllers/playerController.test.js; tests/services/player/growthService.test.js

GET /player/api/pairings | roles=player | query=tournament_id,rounds | exact=tournament_players.tournament_id | sort=computed | redis=none | playerController.getPairings -> player/pairingsService.getPairings | tests=tests/controllers/playerController.test.js
GET /player/api/rankings | roles=player | query=tournament_id | derived=rankings by score desc | sort=computed | redis=none | playerController.getRankings -> player/pairingsService.getRankings | tests=tests/controllers/playerController.test.js
GET /player/api/team-pairings | roles=player | query=tournament_id,rounds | derived=team pairings | sort=computed | redis=none | playerController.getTeamPairings -> player/pairingsService.getTeamPairings | tests=tests/controllers/playerController.test.js
GET /player/api/team-rankings | roles=player | query=tournament_id | derived=team rankings | sort=computed | redis=none | playerController.getTeamRankings -> player/pairingsService.getTeamRankings | tests=tests/controllers/playerController.test.js

GET /player/api/cart | roles=player | query=none | exact=cart.user_email==me | sort=n/a | redis=none | playerController.getCart -> player/ordersService.getCart | tests=tests/controllers/playerController.test.js
GET /player/api/orders | roles=player | query=none | exact=orders.user_email==me | sort=createdAt desc | redis=none | playerController.getOrders -> player/ordersService.getOrders | tests=tests/controllers/playerController.test.js
GET /player/api/notifications | roles=player | query=none | exact=notifications.user_id==me; lookup=tournaments | sort=none specified | redis=none | playerController.getNotifications -> player/notificationsService.getNotifications | tests=tests/controllers/playerController.test.js

GET /player/api/streams | roles=player | query=none | exact=streams.isLive==true OR featured==true | sort=featured desc, updatedAt desc, createdAt desc | redis=Cache.keys.streamsPlayer() tags=[streams] | playerController.getPlayerStreams -> player/streamsService.getPlayerStreams | tests=tests/api/playerStreams.cache.test.js
GET /player/api/announcements | roles=player | query=none | exact=announcements.is_active==true AND target_role in [all,player] | sort=posted_date desc limit=10 | redis=Cache.keys.announcementsPlayer() tags=[announcements] | playerController.getAnnouncements -> player/notificationsService.getAnnouncements | tests=tests/api/playerAnnouncements.cache.test.js
GET /player/api/news | roles=player | query=none | updates sort date desc limit 10; events filter active==true AND date>=now sort date asc limit 20 | redis=Cache.keys.newsPlayer() tags=[news] | playerController.getNews -> player/notificationsService.getNews | tests=none targeted

GET /player/api/complaints | roles=player | query=none | list=union tournament_complaints + complaints (scoped to player); sort=created_at desc; limit=500 | redis=none | playerController.getMyComplaints -> player/complaintsService.getMyComplaints | tests=tests/controllers/playerController.test.js
GET /player/api/wallet-transactions | roles=player | query=none | exact=wallet_transactions.user_id==me | sort=date desc | redis=none | playerController.getWalletTransactions -> player/walletService.getWalletTransactions | tests=tests/controllers/playerController.test.js

========================
STEP 2 (SOLR) - HIGH ROI TARGETS
========================

High ROI full-text + filters/sort/paging:
- /api/users
- /admin/api/contact
- /player/api/store

Secondary (facets/paging/UX improvements):
- /organizer/api/store
- /coordinator/api/store/products
- /coordinator/api/store/complaints
- public blog browse (/api/public/coordinator-blogs*)
-->

# Solr migration plan (WIP)

Step 1 audit is stored in the HTML comment block above.

