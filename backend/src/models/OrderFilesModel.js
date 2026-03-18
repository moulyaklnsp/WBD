const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const OrderFilesModel = {
  async writeDeliverySlipPdf(slip, options = {}) {
    const slipId = slip?.slip_id || slip?.slipId;
    if (!slipId) return null;

    const slipsDir = options.slipsDir || path.join(__dirname, '..', 'public', 'slips');
    try {
      if (!fs.existsSync(slipsDir)) fs.mkdirSync(slipsDir, { recursive: true });
    } catch (e) {
      return null;
    }

    try {
      const pdfPath = path.join(slipsDir, `${slipId}.pdf`);
      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      doc.fontSize(18).text('Delivery Slip', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Slip ID: ${slipId}`);
      doc.text(`Order ID: ${slip?.orderId || slip?.order_id || ''}`);
      const generatedAt = slip?.generatedAt ? new Date(slip.generatedAt) : null;
      doc.text(`Generated: ${generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt.toISOString() : ''}`);
      doc.text(`Delivered By: ${slip?.delivered_by || slip?.deliveredBy || ''}`);
      doc.moveDown(0.5);

      doc.fontSize(12).text('Items:', { underline: true });
      doc.moveDown(0.25);
      const tableTop = doc.y;
      doc.fontSize(10);
      doc.text('Item', 40, tableTop);
      doc.text('Qty', 350, tableTop, { width: 50, align: 'right' });
      doc.text('Amount', 430, tableTop, { width: 80, align: 'right' });
      doc.moveDown(0.5);

      (slip?.items || []).forEach((it) => {
        const y = doc.y;
        const amount = ((it?.price || 0) * (it?.quantity || 1)).toFixed(2);
        doc.text(String(it?.name || ''), 40, y);
        doc.text(String(it?.quantity || 1), 350, y, { width: 50, align: 'right' });
        doc.text(`?${amount}`, 430, y, { width: 80, align: 'right' });
        doc.moveDown(0.3);
      });

      doc.moveDown(0.5);
      const total = Number(slip?.total || 0);
      doc.fontSize(12).text(`Total: ?${total.toFixed(2)}`, { align: 'right' });

      doc.end();
      await new Promise((resolve) => stream.on('finish', resolve));
      return `/slips/${slipId}.pdf`;
    } catch (err) {
      return null;
    }
  }
};

module.exports = OrderFilesModel;
