import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product, CartItem } from '../types';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, Printer, Download, X, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const POS: React.FC = () => {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'POS'>('CASH');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
  }, [token]);

  // Customer Lookup
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
            if (match) {
              setCustomerName(match.name);
            }
          }
        } catch (error) {
          console.error('Error searching customer:', error);
        }
      }
    };
    
    const timeoutId = setTimeout(lookupCustomer, 500);
    return () => clearTimeout(timeoutId);
  }, [customerPhone, token]);

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

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev; // Already in cart, use updateQuantity
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: product.selling_price }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      const item = prev.find(i => i.productId === productId);
      if (!item) return prev;
      
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter(i => i.productId !== productId);
      }
      
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: newQty } : i));
    });
  };

  const updatePrice = (productId: number, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, unitPrice: newPrice } : item))
    );
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!customerName || !customerPhone) {
      alert('Please enter both Customer Name and Phone Number');
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
          items: cart,
        }),
      });

      if (response.ok) {
        const saleData = await response.json();
        const saleDetails = { ...saleData, items: [...cart], customerName, customerPhone, paymentMethod, date: new Date().toLocaleString() };
        setLastSale(saleDetails);
        
        // Reset Form
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setPaymentMethod('CASH');
        setIsCheckoutModalOpen(false);
        
        // Open Invoice Modal
        setIsInvoiceModalOpen(true);
        
        fetchProducts(); // Refresh stock
      } else {
        alert('Sale failed');
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  const generatePDF = (saleData: any, printMode: boolean = false) => {
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
    
    doc.text(`Invoice: ${saleData.invoiceNumber}`, 5, 35);
    doc.text(`Date: ${saleData.date}`, 5, 40);
    doc.text(`Staff: ${user?.name}`, 5, 45);
    doc.text(`Customer: ${saleData.customerName}`, 5, 50);
    doc.text(`Phone: ${saleData.customerPhone}`, 5, 55);

    doc.line(5, 60, 75, 60);

    const tableColumn = ["Item", "Qty", "Price", "Total"];
    const tableRows: any[] = [];

    saleData.items.forEach((item: any) => {
      const itemData = [
        item.name,
        item.quantity,
        item.unitPrice.toLocaleString(),
        (item.quantity * item.unitPrice).toLocaleString()
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 65,
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

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products..."
            className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500 text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* Product List with Inline Cart Controls */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search size={48} className="mb-2 opacity-20" />
              <p className="text-lg">Product not available</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const cartItem = cart.find(item => item.productId === product.id);
              
              return (
                <div
                  key={product.id}
                  className={`border rounded-lg p-4 transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    product.quantity === 0 ? 'opacity-50 bg-gray-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 text-lg">{product.name}</h3>
                      <span className={`text-sm ${product.quantity < 5 ? 'text-red-500' : 'text-gray-500'}`}>
                        {product.quantity} in stock
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {cartItem ? (
                      <>
                        {/* Price Edit Input */}
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-sm">₦</span>
                          <input
                            type="number"
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-right font-bold text-emerald-600 focus:ring-emerald-500 focus:border-emerald-500"
                            value={cartItem.unitPrice}
                            onChange={(e) => updatePrice(product.id, parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="p-2 rounded-md bg-white shadow-sm hover:bg-gray-50 text-gray-700"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={product.quantity}
                            value={cartItem.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              const newQty = Math.min(Math.max(1, val), product.quantity);
                              updateQuantity(product.id, newQty - cartItem.quantity);
                            }}
                            className="w-12 text-center font-bold text-lg bg-transparent border-none focus:ring-0 p-0"
                          />
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="p-2 rounded-md bg-white shadow-sm hover:bg-gray-50 text-emerald-600"
                            disabled={cartItem.quantity >= product.quantity}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        
                        <div className="text-right min-w-[80px]">
                          <div className="text-xs text-gray-500">Subtotal</div>
                          <div className="font-bold text-gray-900">₦{(cartItem.quantity * cartItem.unitPrice).toLocaleString()}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-emerald-600 font-bold text-lg mr-4">
                          ₦{product.selling_price.toLocaleString()}
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.quantity === 0}
                          className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Plus size={18} />
                          Add
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Checkout Bar */}
        {cart.length > 0 && (
          <div className="p-4 bg-slate-900 text-white shadow-lg border-t border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-full">
                  <ShoppingCart size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Items in Cart</p>
                  <p className="font-bold text-xl">{cart.reduce((a, b) => a + b.quantity, 0)}</p>
                </div>
              </div>
              <div className="h-10 w-px bg-slate-700"></div>
              <div>
                <p className="text-slate-400 text-sm">Total Amount</p>
                <p className="font-bold text-2xl text-emerald-400">₦{calculateTotal().toLocaleString()}</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-lg shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
            >
              Proceed to Checkout
              <CreditCard size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Complete Sale</h2>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-emerald-500 focus:border-emerald-500"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500 ring-opacity-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Banknote size={24} className="mb-1" />
                    <span className="text-xs font-medium">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      paymentMethod === 'TRANSFER' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500 ring-opacity-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Smartphone size={24} className="mb-1" />
                    <span className="text-xs font-medium">Transfer</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('POS')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      paymentMethod === 'POS' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500 ring-opacity-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard size={24} className="mb-1" />
                    <span className="text-xs font-medium">POS</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mt-4 border border-gray-100">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Items Count</span>
                  <span className="font-medium">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total to Pay</span>
                  <span className="text-emerald-600">₦{calculateTotal().toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold text-lg hover:bg-emerald-700 shadow-lg mt-4"
              >
                Confirm Sale
              </button>
            </div>
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
              <button
                onClick={() => generatePDF(lastSale, false)}
                className="w-full py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Download Invoice
              </button>
              
              <button
                onClick={() => generatePDF(lastSale, true)}
                className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                Print Invoice
              </button>
              
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm mt-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
