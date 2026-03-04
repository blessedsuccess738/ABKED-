import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product } from '../types';
import { Plus, Search, AlertTriangle, Check, ShoppingCart, X, CreditCard, Banknote, Smartphone, FileText, Download, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Inventory: React.FC = () => {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [recentUpdates, setRecentUpdates] = useState<number[]>([]);
  
  // Quick Sale State
  const [quickSaleProduct, setQuickSaleProduct] = useState<Product | null>(null);
  const [saleQuantity, setSaleQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'POS'>('CASH');
  const [lastSale, setLastSale] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Add Product Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', costPrice: '', sellingPrice: '', quantity: '', lowStockThreshold: '5' });

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setProducts(await response.json());
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);

  // Handle Inline Edit
  const handleEditClick = (product: Product, field: string) => {
    if (user?.role !== 'ADMIN' && field === 'cost_price') return; // Only admin can edit cost price
    setEditingCell({ id: product.id, field });
    setEditValue(product[field as keyof Product]?.toString() || '');
  };

  const handleEditSave = async (product: Product) => {
    if (!editingCell) return;
    
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      setEditingCell(null);
      return;
    }

    const updatedProduct = { ...product, [editingCell.field]: newValue };
    
    // Optimistic update
    setProducts(products.map(p => p.id === product.id ? updatedProduct : p));
    setEditingCell(null);

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: updatedProduct.name,
          category: updatedProduct.category,
          costPrice: updatedProduct.cost_price,
          sellingPrice: updatedProduct.selling_price,
          quantity: updatedProduct.quantity,
          lowStockThreshold: updatedProduct.low_stock_threshold
        }),
      });

      if (response.ok) {
        // Show success checkmark briefly
        setRecentUpdates(prev => [...prev, product.id]);
        setTimeout(() => {
          setRecentUpdates(prev => prev.filter(id => id !== product.id));
        }, 3000);
        fetchProducts(); // Refresh to get updated timestamp
      } else {
        fetchProducts(); // Revert on error
      }
    } catch (error) {
      console.error('Error updating product:', error);
      fetchProducts(); // Revert on error
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, product: Product) => {
    if (e.key === 'Enter') {
      handleEditSave(product);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Quick Sale Logic
  const handleQuickSale = async () => {
    if (!quickSaleProduct) return;
    if (!customerName || !customerPhone) {
      alert('Please enter Customer Name and Phone Number');
      return;
    }

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName,
          customerPhone,
          paymentMethod,
          items: [{
            productId: quickSaleProduct.id,
            name: quickSaleProduct.name,
            quantity: saleQuantity,
            unitPrice: quickSaleProduct.selling_price
          }],
        }),
      });

      if (response.ok) {
        const saleData = await response.json();
        setLastSale({
          ...saleData,
          items: [{ name: quickSaleProduct.name, quantity: saleQuantity, unitPrice: quickSaleProduct.selling_price }],
          customerName,
          customerPhone,
          paymentMethod,
          date: new Date().toLocaleString()
        });
        
        setQuickSaleProduct(null);
        setSaleQuantity(1);
        setCustomerName('');
        setCustomerPhone('');
        setIsInvoiceModalOpen(true);
        fetchProducts();
      } else {
        alert('Sale failed');
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  // Add Product Logic
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          costPrice: parseFloat(formData.costPrice),
          sellingPrice: parseFloat(formData.sellingPrice),
          quantity: parseInt(formData.quantity),
          lowStockThreshold: parseInt(formData.lowStockThreshold)
        }),
      });

      if (response.ok) {
        setIsAddModalOpen(false);
        setFormData({ name: '', category: '', costPrice: '', sellingPrice: '', quantity: '', lowStockThreshold: '5' });
        fetchProducts();
      }
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const generatePDF = (saleData: any, printMode: boolean = false) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
    doc.setFontSize(10);
    doc.text('ABKED ENTERPRISE', 40, 10, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Gadget & Electronics Store', 40, 15, { align: 'center' });
    doc.text('Email: abkedenterises@gmail.com', 40, 20, { align: 'center' });
    doc.text('WhatsApp: +2349041519151', 40, 25, { align: 'center' });
    doc.line(5, 30, 75, 30);
    doc.text(`Invoice: ${saleData.invoiceNumber}`, 5, 35);
    doc.text(`Date: ${saleData.date}`, 5, 40);
    doc.text(`Staff: ${user?.name}`, 5, 45);
    doc.text(`Customer: ${saleData.customerName}`, 5, 50);
    doc.text(`Phone: ${saleData.customerPhone}`, 5, 55);
    doc.line(5, 60, 75, 60);

    const tableColumn = ["Item", "Qty", "Price", "Total"];
    const tableRows: any[] = [];
    saleData.items.forEach((item: any) => {
      tableRows.push([item.name, item.quantity, item.unitPrice.toLocaleString(), (item.quantity * item.unitPrice).toLocaleString()]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 65,
      theme: 'plain',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'right' }, 3: { cellWidth: 20, halign: 'right' } },
      margin: { left: 5, right: 5 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(10);
    doc.text(`TOTAL: ${saleData.totalAmount.toLocaleString()}`, 75, finalY, { align: 'right' });
    doc.setFontSize(8);
    doc.text('Thank You For Shopping With Us', 40, finalY + 10, { align: 'center' });

    if (printMode) {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } else {
      doc.save(`Invoice-${saleData.invoiceNumber}.pdf`);
    }
  };

  // Customer Lookup for Quick Sale
  useEffect(() => {
    const lookupCustomer = async () => {
      if (customerPhone.length >= 4) {
        try {
          const response = await fetch(`/api/customers/search?q=${customerPhone}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const customers = await response.json();
            const match = customers.find((c: any) => c.phone === customerPhone);
            if (match) setCustomerName(match.name);
          }
        } catch (error) {}
      }
    };
    const timeoutId = setTimeout(lookupCustomer, 500);
    return () => clearTimeout(timeoutId);
  }, [customerPhone, token]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculations
  const totalProducts = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalStockWorth = products.reduce((sum, p) => sum + (p.cost_price * p.quantity), 0);
  const lowStockItems = products.filter(p => p.quantity <= p.low_stock_threshold).length;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Total Quantity in Store</p>
          <p className="text-2xl font-bold text-gray-900">{totalQuantity}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Total Stock Worth</p>
          <p className="text-2xl font-bold text-emerald-600">
            {user?.role === 'ADMIN' ? `₦${totalStockWorth.toLocaleString()}` : '***'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 font-medium">Low Stock Items</p>
          <p className="text-2xl font-bold text-red-600">{lowStockItems}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products or categories..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 shadow-sm"
          >
            <Plus size={20} />
            Add Product
          </button>
        )}
      </div>

      {/* Excel-Style Grid */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Category</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Cost Price</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Selling Price</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Quantity</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Stock Value</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200">Last Updated</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Quick Sale</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const isRecentlyUpdated = recentUpdates.includes(product.id);
                
                return (
                  <tr key={product.id} className={`hover:bg-blue-50 transition-colors ${isRecentlyUpdated ? 'bg-emerald-50' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap border-r border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{product.name}</span>
                        {isRecentlyUpdated && <Check size={16} className="text-emerald-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 border-r border-gray-100">{product.category}</td>
                    
                    {/* Cost Price (Editable by Admin) */}
                    <td 
                      className={`px-4 py-3 whitespace-nowrap text-sm text-right border-r border-gray-100 ${user?.role === 'ADMIN' ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                      onClick={() => handleEditClick(product, 'cost_price')}
                    >
                      {editingCell?.id === product.id && editingCell.field === 'cost_price' ? (
                        <input
                          type="number"
                          autoFocus
                          className="w-full text-right border-b-2 border-emerald-500 focus:outline-none bg-transparent"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleEditSave(product)}
                          onKeyDown={(e) => handleKeyDown(e, product)}
                        />
                      ) : (
                        <span className="text-gray-500">{user?.role === 'ADMIN' ? `₦${product.cost_price.toLocaleString()}` : '***'}</span>
                      )}
                    </td>

                    {/* Selling Price (Editable) */}
                    <td 
                      className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium cursor-pointer hover:bg-gray-100 border-r border-gray-100"
                      onClick={() => handleEditClick(product, 'selling_price')}
                    >
                      {editingCell?.id === product.id && editingCell.field === 'selling_price' ? (
                        <input
                          type="number"
                          autoFocus
                          className="w-full text-right border-b-2 border-emerald-500 focus:outline-none bg-transparent font-bold text-emerald-600"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleEditSave(product)}
                          onKeyDown={(e) => handleKeyDown(e, product)}
                        />
                      ) : (
                        <span className="text-emerald-600 font-bold">₦{product.selling_price.toLocaleString()}</span>
                      )}
                    </td>

                    {/* Quantity (Editable) */}
                    <td 
                      className="px-4 py-3 whitespace-nowrap text-sm text-right cursor-pointer hover:bg-gray-100 border-r border-gray-100"
                      onClick={() => handleEditClick(product, 'quantity')}
                    >
                      {editingCell?.id === product.id && editingCell.field === 'quantity' ? (
                        <input
                          type="number"
                          autoFocus
                          className="w-full text-right border-b-2 border-emerald-500 focus:outline-none bg-transparent"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleEditSave(product)}
                          onKeyDown={(e) => handleKeyDown(e, product)}
                        />
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {product.quantity <= product.low_stock_threshold && <AlertTriangle size={14} className="text-red-500" />}
                          <span className={product.quantity <= product.low_stock_threshold ? 'text-red-600 font-bold' : 'text-gray-900'}>
                            {product.quantity}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Stock Value */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 border-r border-gray-100 bg-gray-50">
                      {user?.role === 'ADMIN' ? `₦${(product.cost_price * product.quantity).toLocaleString()}` : '***'}
                    </td>

                    {/* Last Updated */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 border-r border-gray-100">
                      {product.updated_at ? new Date(product.updated_at).toLocaleString() : '-'}
                    </td>

                    {/* Quick Sale Action */}
                    <td className="px-4 py-2 whitespace-nowrap text-center">
                      <button
                        onClick={() => setQuickSaleProduct(product)}
                        disabled={product.quantity === 0}
                        className="inline-flex items-center justify-center px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                      >
                        <ShoppingCart size={14} className="mr-1" />
                        Sale
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Sale Modal */}
      {quickSaleProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="text-emerald-600" /> Quick Sale
              </h2>
              <button onClick={() => setQuickSaleProduct(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
              <h3 className="font-bold text-lg text-gray-900">{quickSaleProduct.name}</h3>
              <p className="text-sm text-gray-500">Stock Available: {quickSaleProduct.quantity}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Quantity to Sell:</span>
                <input
                  type="number"
                  min="1"
                  max={quickSaleProduct.quantity}
                  value={saleQuantity}
                  onChange={(e) => setSaleQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), quickSaleProduct.quantity))}
                  className="w-20 border border-gray-300 rounded p-1 text-right font-bold focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="mt-3 flex justify-between items-center border-t border-gray-200 pt-3">
                <span className="font-bold text-gray-700">Total:</span>
                <span className="text-xl font-bold text-emerald-600">₦{(quickSaleProduct.selling_price * saleQuantity).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setPaymentMethod('CASH')} className={`flex flex-col items-center p-2 rounded border ${paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Banknote size={20} className="mb-1" /> <span className="text-xs font-medium">Cash</span>
                  </button>
                  <button onClick={() => setPaymentMethod('TRANSFER')} className={`flex flex-col items-center p-2 rounded border ${paymentMethod === 'TRANSFER' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <Smartphone size={20} className="mb-1" /> <span className="text-xs font-medium">Transfer</span>
                  </button>
                  <button onClick={() => setPaymentMethod('POS')} className={`flex flex-col items-center p-2 rounded border ${paymentMethod === 'POS' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <CreditCard size={20} className="mb-1" /> <span className="text-xs font-medium">POS</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleQuickSale}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md mt-2"
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal (Admin Only) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Add New Product</h2>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product Name</label>
                <input type="text" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input type="text" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cost Price</label>
                  <input type="number" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Selling Price</label>
                  <input type="number" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantity</label>
                  <input type="number" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Low Stock Alert</label>
                  <input type="number" required className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Success Modal */}
      {isInvoiceModalOpen && lastSale && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sale Successful!</h2>
            <p className="text-gray-500 mb-6">Invoice #{lastSale.invoiceNumber} generated.</p>
            
            <div className="space-y-3">
              <button onClick={() => generatePDF(lastSale, false)} className="w-full py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 flex items-center justify-center gap-2">
                <Download size={20} /> Download Invoice
              </button>
              <button onClick={() => generatePDF(lastSale, true)} className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
                <Printer size={20} /> Print Invoice
              </button>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm mt-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
