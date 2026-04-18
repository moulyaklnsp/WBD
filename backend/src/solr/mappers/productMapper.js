const { normalizeKey } = require('../../utils/mongo');

function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function mapProductToSolrDoc(product) {
  const id = product?._id != null ? String(product._id) : '';
  const name = safeTrim(product?.name);
  const category = safeTrim(product?.category);
  const college = safeTrim(product?.college);
  const coordinator = safeTrim(product?.coordinator || product?.coordinator_email || product?.coordinatorEmail).toLowerCase();
  const availability = Number(product?.availability ?? product?.stock ?? 0) || 0;
  const price = Number(product?.price ?? 0) || 0;
  const commentsEnabled = Boolean(product?.comments_enabled === true || product?.comments_enabled === 1 || product?.comments_enabled === '1');

  return {
    id: id ? `products:${id}` : undefined,
    product_name_txt: name || undefined,
    product_name_s: normalizeKey(name) || undefined,
    product_category_s: category || undefined,
    product_price_f: price,
    product_availability_l: availability,
    product_college_s: college || undefined,
    product_coordinator_s: coordinator || undefined,
    product_comments_enabled_b: commentsEnabled,
    visible_to: ['admin', 'organizer', 'coordinator', 'player'],
    updated_at_dt: product?.updatedAt || product?.updated_at || product?.updated_date || undefined,
    created_at_dt: product?.createdAt || product?.created_at || product?.added_date || product?.created_date || undefined
  };
}

module.exports = { mapProductToSolrDoc };

