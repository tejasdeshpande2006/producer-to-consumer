import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, X, CheckCircle, Clock, Package } from 'lucide-react';
import { Order } from '../types';

interface ReceiptProps {
  order: Order;
  sellerName?: string;
  sellerEmail?: string;
  sellerPhone?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  onClose: () => void;
  type: 'invoice' | 'receipt';
}

const Receipt: React.FC<ReceiptProps> = ({
  order,
  sellerName = 'Producer Store',
  sellerEmail,
  sellerPhone,
  buyerEmail,
  buyerPhone,
  onClose,
  type
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Cart prices already include 5% platform fee
  const subtotalWithFee = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const baseAmount = subtotalWithFee / 1.05;
  const platformFee = subtotalWithFee - baseAmount;
  const gst = subtotalWithFee * 0.18;
  const shippingFee = 0;
  const total = subtotalWithFee + gst + shippingFee;

  const invoiceNumber = `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const orderDate = order.timestamp?.toDate?.() || new Date();
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const qrData = JSON.stringify({
    invoiceNumber,
    orderId: order.id,
    total: total.toFixed(2),
    date: formattedDate
  });

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${type === 'invoice' ? 'Invoice' : 'Receipt'} - ${invoiceNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1a1a1a; }
            .receipt { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { font-size: 28px; font-weight: 800; color: #4f46e5; }
            .invoice-title { font-size: 24px; color: #374151; margin-top: 10px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .info-section h3 { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
            .info-section p { font-size: 14px; color: #374151; margin-bottom: 4px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
            .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .totals-row.total { border-top: 2px solid #4f46e5; font-weight: 700; font-size: 18px; color: #4f46e5; }
            .qr-section { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #e5e7eb; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            .status-delivered { background: #d1fae5; color: #059669; }
            .status-pending { background: #fef3c7; color: #d97706; }
            .status-confirmed { background: #dbeafe; color: #2563eb; }
            .status-shipped { background: #e0e7ff; color: #4f46e5; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229);
    doc.text('P2C', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text('Producer to Consumer', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(16);
    doc.setTextColor(55, 65, 81);
    doc.text(type === 'invoice' ? 'TAX INVOICE' : 'RECEIPT', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Invoice details
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Invoice Number: ${invoiceNumber}`, 20, y);
    doc.text(`Date: ${formattedDate} ${formattedTime}`, pageWidth - 20, y, { align: 'right' });
    y += 15;

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.line(20, y, pageWidth - 20, y);
    y += 15;

    // Bill To / Sold By
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('BILL TO', 20, y);
    doc.text('SOLD BY', pageWidth / 2 + 10, y);
    y += 6;

    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(order.buyerName || 'Customer', 20, y);
    doc.text(sellerName, pageWidth / 2 + 10, y);
    y += 5;

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    if (buyerEmail) {
      doc.text(buyerEmail, 20, y);
      y += 5;
    }
    if (buyerPhone) {
      doc.text(buyerPhone, 20, y);
      y += 5;
    }
    
    let sellerY = y - (buyerEmail ? 5 : 0) - (buyerPhone ? 5 : 0);
    if (sellerEmail) {
      doc.text(sellerEmail, pageWidth / 2 + 10, sellerY);
      sellerY += 5;
    }
    if (sellerPhone) {
      doc.text(sellerPhone, pageWidth / 2 + 10, sellerY);
    }
    y += 5;

    // Shipping Address
    if (order.shippingAddress) {
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('SHIPPING ADDRESS', 20, y);
      y += 6;
      doc.setTextColor(55, 65, 81);
      const addressLines = doc.splitTextToSize(order.shippingAddress, 80);
      doc.text(addressLines, 20, y);
      y += addressLines.length * 5 + 10;
    }

    y += 5;

    // Items Table Header
    doc.setFillColor(243, 244, 246);
    doc.rect(20, y - 4, pageWidth - 40, 10, 'F');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('ITEM', 25, y + 2);
    doc.text('QTY', 120, y + 2);
    doc.text('PRICE', 145, y + 2);
    doc.text('TOTAL', pageWidth - 25, y + 2, { align: 'right' });
    y += 12;

    // Items
    doc.setTextColor(31, 41, 55);
    order.items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      doc.setFontSize(10);
      const titleLines = doc.splitTextToSize(item.title, 90);
      doc.text(titleLines, 25, y);
      doc.text(item.quantity.toString(), 125, y);
      doc.text(`₹${item.price.toFixed(2)}`, 145, y);
      doc.text(`₹${itemTotal.toFixed(2)}`, pageWidth - 25, y, { align: 'right' });
      y += titleLines.length * 5 + 8;
    });

    y += 5;
    doc.setDrawColor(229, 231, 235);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Totals
    const totalsX = pageWidth - 80;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text('Base Amount:', totalsX, y);
    doc.setTextColor(31, 41, 55);
    doc.text(`₹${baseAmount.toFixed(2)}`, pageWidth - 25, y, { align: 'right' });
    y += 7;

    doc.setTextColor(107, 114, 128);
    doc.text('Platform Fee (5%):', totalsX, y);
    doc.setTextColor(31, 41, 55);
    doc.text(`₹${platformFee.toFixed(2)}`, pageWidth - 25, y, { align: 'right' });
    y += 7;

    doc.setTextColor(107, 114, 128);
    doc.text('Subtotal:', totalsX, y);
    doc.setTextColor(31, 41, 55);
    doc.text(`₹${subtotalWithFee.toFixed(2)}`, pageWidth - 25, y, { align: 'right' });
    y += 7;

    doc.setTextColor(107, 114, 128);
    doc.text('GST (18%):', totalsX, y);
    doc.setTextColor(31, 41, 55);
    doc.text(`₹${gst.toFixed(2)}`, pageWidth - 25, y, { align: 'right' });
    y += 7;

    doc.setTextColor(107, 114, 128);
    doc.text('Shipping:', totalsX, y);
    doc.setTextColor(34, 197, 94);
    doc.text('FREE', pageWidth - 25, y, { align: 'right' });
    y += 10;

    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, pageWidth - 20, y);
    y += 8;

    doc.setFontSize(14);
    doc.setTextColor(79, 70, 229);
    doc.text('Total:', totalsX, y);
    doc.text(`₹${total.toFixed(2)}`, pageWidth - 25, y, { align: 'right' });
    y += 15;

    // Status
    const statusColors: Record<string, [number, number, number]> = {
      delivered: [5, 150, 105],
      pending: [217, 119, 6],
      confirmed: [37, 99, 235],
      shipped: [79, 70, 229]
    };
    const statusColor = statusColors[order.status] || [107, 114, 128];
    doc.setFontSize(10);
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${order.status.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
    y += 20;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Thank you for shopping with P2C!', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('This is a computer-generated document.', pageWidth / 2, y, { align: 'center' });

    doc.save(`${invoiceNumber}.pdf`);
  };

  const getStatusIcon = () => {
    switch (order.status) {
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'shipped': return <Package className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusClass = () => {
    switch (order.status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Action Bar */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {type === 'invoice' ? 'Tax Invoice' : 'Receipt'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div ref={receiptRef} className="p-8">
            {/* Header */}
            <div className="text-center border-b-2 border-indigo-600 pb-6 mb-6">
              <h1 className="text-3xl font-black text-indigo-600">P2C</h1>
              <p className="text-sm text-gray-500">Producer to Consumer</p>
              <p className="text-xl font-semibold text-gray-700 mt-2">
                {type === 'invoice' ? 'TAX INVOICE' : 'RECEIPT'}
              </p>
            </div>

            {/* Invoice Info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Invoice Number</p>
                <p className="text-lg font-bold text-gray-800">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Date</p>
                <p className="font-semibold text-gray-800">{formattedDate}</p>
                <p className="text-sm text-gray-500">{formattedTime}</p>
              </div>
            </div>

            {/* Bill To / Sold By */}
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Bill To</p>
                <p className="font-semibold text-gray-800">{order.buyerName || 'Customer'}</p>
                {buyerEmail && <p className="text-sm text-gray-600">{buyerEmail}</p>}
                {buyerPhone && <p className="text-sm text-gray-600">{buyerPhone}</p>}
                {order.shippingAddress && (
                  <p className="text-sm text-gray-600 mt-2">{order.shippingAddress}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sold By</p>
                <p className="font-semibold text-gray-800">{sellerName}</p>
                {sellerEmail && <p className="text-sm text-gray-600">{sellerEmail}</p>}
                {sellerPhone && <p className="text-sm text-gray-600">{sellerPhone}</p>}
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-3 text-xs text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="text-center p-3 text-xs text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right p-3 text-xs text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="text-right p-3 text-xs text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="p-3 text-gray-800">{item.title}</td>
                    <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                    <td className="p-3 text-right text-gray-600">₹{item.price.toFixed(2)}</td>
                    <td className="p-3 text-right font-medium text-gray-800">
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-72">
                <div className="flex justify-between py-2 text-gray-600">
                  <span>Base Amount</span>
                  <span>₹{baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-600">
                  <span>Platform Fee (5%)</span>
                  <span>₹{platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-600 border-t border-gray-200">
                  <span>Subtotal</span>
                  <span>₹{subtotalWithFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-600">
                  <span>GST (18%)</span>
                  <span>₹{gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-600">
                  <span>Shipping</span>
                  <span className="text-green-600 font-medium">FREE</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-indigo-600 text-lg font-bold text-indigo-600">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center mb-6">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getStatusClass()}`}>
                {getStatusIcon()}
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>

            {/* QR Code */}
            <div className="text-center border-t border-dashed border-gray-300 pt-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Scan for Details</p>
              <div className="inline-block p-3 bg-white border border-gray-200 rounded-xl">
                <QRCodeSVG value={qrData} size={100} />
              </div>
            </div>

            {/* Footer */}
            <div className="text-center mt-6 text-sm text-gray-400">
              <p>Thank you for shopping with P2C!</p>
              <p className="text-xs mt-1">This is a computer-generated document.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
