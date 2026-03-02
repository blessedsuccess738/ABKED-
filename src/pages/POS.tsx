import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product, CartItem } from '../types';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, Smartphone, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const POS: React.FC = () => {
  const { user, token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'POS'>('CASH');
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
  }, [token]);

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
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: product.selling_price }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
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

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName,
          paymentMethod,
          items: cart,
        }),
      });

      if (response.ok) {
        const saleData = await response.json();
        setLastSale({ ...saleData, items: cart, customerName, paymentMethod, date: new Date().toLocaleString() });
        setCart([]);
        setCustomerName('');
        setPaymentMethod('CASH');
        setIsCheckoutModalOpen(false);
        fetchProducts(); // Refresh stock
        // Auto print or show print modal
        setTimeout(() => generateInvoice(saleData, cart), 500);
      } else {
        alert('Sale failed');
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  const generateInvoice = (saleData: any, items: CartItem[]) => {
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
    doc.text(`Date: ${new Date().toLocaleString()}`, 5, 40);
    doc.text(`Staff: ${user?.name}`, 5, 45);
    if (customerName) doc.text(`Customer: ${customerName}`, 5, 50);

    doc.line(5, 55, 75, 55);

    const tableColumn = ["Item", "Qty", "Price", "Total"];
    const tableRows: any[] = [];

    items.forEach(item => {
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
    doc.text(`TOTAL: ${calculateTotal().toLocaleString()}`, 75, finalY, { align: 'right' });
    
    doc.setFontSize(8);
    doc.text('Thank You For Shopping With Us', 40, finalY + 10, { align: 'center' });

    doc.save(`Invoice-${saleData.invoiceNumber}.pdf`);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      {/* Product List */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-emerald-500 focus:border-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => addToCart(product)}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                product.quantity === 0 ? 'opacity-50 pointer-events-none bg-gray-50' : 'bg-white hover:border-emerald-500'
              }`}
            >
              <div className="h-20 bg-gray-100 rounded-md mb-3 flex items-center justify-center text-gray-400">
                <Smartphone size={32} />
              </div>
              <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
              <div className="flex justify-between items-center mt-2">
                <span className="text-emerald-600 font-bold">₦{product.selling_price.toLocaleString()}</span>
                <span className={`text-xs ${product.quantity < 5 ? 'text-red-500' : 'text-gray-500'}`}>
                  {product.quantity} left
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={20} />
            Current Sale
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={48} className="mb-2 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="flex flex-col gap-2 border-b border-gray-100 pb-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-gray-800">{item.name}</h4>
                  <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="p-1 rounded-md bg-gray-100 hover:bg-gray-200"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="p-1 rounded-md bg-gray-100 hover:bg-gray-200"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">@</span>
                    <input
                      type="number"
                      className="w-20 text-right border border-gray-200 rounded px-1 py-0.5 text-sm"
                      value={item.unitPrice}
                      onChange={(e) => updatePrice(item.productId, parseFloat(e.target.value))}
                    />
                  </div>
                </div>
                <div className="text-right font-bold text-gray-800">
                  ₦{(item.quantity * item.unitPrice).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">Total Amount</span>
            <span className="text-2xl font-bold text-emerald-600">₦{calculateTotal().toLocaleString()}</span>
          </div>
          <button
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-6">Complete Sale</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name (Optional)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                      paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Banknote size={24} className="mb-1" />
                    <span className="text-xs font-medium">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                      paymentMethod === 'TRANSFER' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Smartphone size={24} className="mb-1" />
                    <span className="text-xs font-medium">Transfer</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('POS')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                      paymentMethod === 'POS' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard size={24} className="mb-1" />
                    <span className="text-xs font-medium">POS</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Items Count</span>
                  <span className="font-medium">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total to Pay</span>
                  <span className="text-emerald-600">₦{calculateTotal().toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Confirm Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
