import {
  Order,
  SELLER_PLATFORM_COMMISSION_RATE,
  extractPincodeFromAddress,
  getOrderStatusLabel,
  isOnlinePaidOrder,
} from '../types';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function buildOrdersCsvContent(orders: Order[]): string {
  const headers = [
    'Order ID',
    'Date',
    'Customer Name',
    'Pincode',
    'Items',
    'Payment Mode',
    'Subtotal (INR)',
    '10% Commission (INR)',
    'Delivery Fee (INR)',
    'Final Total (INR)',
    'Order Status',
  ];

  const rows = orders.map((ord) => {
    const itemsSubtotal =
      typeof ord.subtotal === 'number'
        ? roundMoney(ord.subtotal)
        : roundMoney(
            (ord.items || []).reduce(
              (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
              0
            )
          );

    const isVoided =
      ord.status === 'Cancelled' ||
      ord.status === 'Refunded' ||
      ord.status === 'Return Approved';

    const commission = isVoided
      ? 0
      : roundMoney(itemsSubtotal * SELLER_PLATFORM_COMMISSION_RATE);

    const deliveryFee = roundMoney(Number(ord.deliveryFee || 0));
    const finalTotal = roundMoney(Number(ord.total_amount ?? ord.total ?? itemsSubtotal));
    const pincode = extractPincodeFromAddress(ord.address, ord.pincode) || '110039';
    const paymentMode = isOnlinePaidOrder(ord) ? 'Razorpay' : 'COD';
    const itemsSummary = (ord.items || [])
      .map((it) => `${it.product_name} x${it.quantity}`)
      .join(' | ');

    const formattedDate = new Date(ord.created_at).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      `#${ord.id}`,
      formattedDate,
      ord.name || 'Customer',
      pincode,
      itemsSummary,
      paymentMode,
      itemsSubtotal.toFixed(2),
      commission.toFixed(2),
      deliveryFee.toFixed(2),
      finalTotal.toFixed(2),
      getOrderStatusLabel(ord.status),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  // Prepend UTF-8 BOM so Microsoft Excel & Google Sheets open Indian text cleanly
  return '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

export function exportOrdersToCsv(orders: Order[], filenamePrefix = 'smart-basket-orders'): {
  exportedCount: number;
  filename: string;
} {
  const csv = buildOrdersCsvContent(orders);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}-${dateStamp}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { exportedCount: orders.length, filename };
}
