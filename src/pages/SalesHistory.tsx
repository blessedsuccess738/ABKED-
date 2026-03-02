import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sale, SaleItem } from '../types';
import { Search, Eye, Printer, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';

import autoTable from 'jspdf-autotable';

const SalesHistory: React.FC = () => {
  const { user, token } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale & { items: SaleItem[] } | null>(null);

  useEffect(() => {
    fetchSales();
  }, [token]);

  const fetchSales = async () => {
    try {
      const response = await fetch('/api/sales', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setSales(await response.json());
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSaleDetails = async (saleId: number) => {
    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setSelectedSale(await response.json());
      }
    } catch (error) {
      console.error('Error fetching sale details:', error);
    }
  };

  const printInvoice = (sale: any) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200]
    });

    doc.setFontSize(10);
    doc.text('ABKED ENTERPRISE', 40, 10, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Gadget & Electronics Store', 40, 15, { align: 'center' });
    doc.text('Email: abkedenterises@gmail.com', 40, 20, { align: 'center' });
    doc.text('WhatsApp: +2349041519151', 40, 25, { align: 'center' });
    
    doc.line(5, 30, 75, 30);
    
    doc.text(`Invoice: ${sale.invoice_number}`, 5, 35);
    doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`, 5, 40);
    doc.text(`Staff: ${sale.staff_name}`, 5, 45);
    if (sale.customer_name) doc.text(`Customer: ${sale.customer_name}`, 5, 50);

    doc.line(5, 55, 75, 55);

    const tableColumn = ["Item", "Qty", "Price", "Total"];
    const tableRows: any[] = [];

    sale.items.forEach((item: any) => {
      const itemData = [
        item.product_name,
        item.quantity,
        item.unit_price.toLocaleString(),
        (item.quantity * item.unit_price).toLocaleString()
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 60,
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' }
      },
      margin: { left: 5, right: 5 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;

    doc.setFontSize(10);
    doc.text(`TOTAL: ${sale.total_amount.toLocaleString()}`, 75, finalY, { align: 'right' });
    
    doc.setFontSize(8);
    doc.text('Thank You For Shopping With Us', 40, finalY + 10, { align: 'center' });

    doc.save(`Invoice-${sale.invoice_number}.pdf`);
  };

  const filteredSales = sales.filter(s => 
    s.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search invoice..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sale.invoice_number}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(sale.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.customer_name || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.staff_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">₦{sale.total_amount.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {sale.payment_method}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => fetchSaleDetails(sale.id)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Invoice Details: {selectedSale.invoice_number}</h2>
              <button 
                onClick={() => setSelectedSale(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{selectedSale.customer_name || 'Walk-in'}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">{new Date(selectedSale.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Payment Method</p>
                <p className="font-medium">{selectedSale.payment_method}</p>
              </div>
              <div>
                <p className="text-gray-500">Sold By</p>
                <p className="font-medium">{selectedSale.staff_name}</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedSale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">₦{item.unit_price.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">₦{item.total_price.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right font-bold text-gray-900">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-emerald-600">₦{selectedSale.total_amount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => printInvoice(selectedSale)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
              >
                <Printer size={18} />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
