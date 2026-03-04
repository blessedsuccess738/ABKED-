import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb } from './server/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'abked-secret-key-change-in-prod';

// Initialize Database
initDb();

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    // Check if user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Determine role
    const role = email === 'abkedenterises@gmail.com' ? 'ADMIN' : 'STAFF';

    const stmt = db.prepare('INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)');
    const info = stmt.run(fullName, email, hashedPassword, role);

    res.status(201).json({ message: 'User created successfully', userId: info.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.full_name, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- PRODUCT ROUTES ---

app.get('/api/products', authenticateToken, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  res.json(products);
});

app.post('/api/products', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  
  const { name, category, costPrice, sellingPrice, quantity, lowStockThreshold } = req.body;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO products (name, category, cost_price, selling_price, quantity, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(name, category, costPrice, sellingPrice, quantity, lowStockThreshold || 5);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating product' });
  }
});

app.put('/api/products/:id', authenticateToken, (req: any, res) => {
  const { id } = req.params;
  const { name, category, costPrice, sellingPrice, quantity, lowStockThreshold } = req.body;
  const userId = req.user.id;

  // Get old product for logging
  const oldProduct: any = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  
  if (!oldProduct) return res.status(404).json({ message: 'Product not found' });

  // Log price change if selling price changed
  if (oldProduct.selling_price !== sellingPrice) {
    db.prepare(`
      INSERT INTO price_logs (product_id, old_price, new_price, changed_by_user_id)
      VALUES (?, ?, ?, ?)
    `).run(id, oldProduct.selling_price, sellingPrice, userId);
  }

  try {
    // If staff is editing, they might only be changing price during sale, but let's allow full edit for now based on requirements "Edit product price (if necessary)"
    // Ideally staff should only edit price during sale, but the prompt says "Edit product price".
    // Admin can edit everything.
    
    // For simplicity, allow update.
    const stmt = db.prepare(`
      UPDATE products 
      SET name = ?, category = ?, cost_price = ?, selling_price = ?, quantity = ?, low_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    // Only admin can change cost price and quantity directly (except via sales)
    // But prompt says "Admin can... Set cost price... Set quantity".
    // Staff can "Edit product price".
    // Let's restrict cost price update to admin.
    
    let newCostPrice = oldProduct.cost_price;
    let newQuantity = oldProduct.quantity; // Quantity usually updated via stock management or sales
    
    if (req.user.role === 'ADMIN') {
        newCostPrice = costPrice;
        newQuantity = quantity;
    } else {
        // Staff logic: if they send quantity, ignore it? Or allow stock adjustments?
        // Prompt says "Admin can... Set quantity". Staff "Enter quantity" refers to sales.
        // So staff shouldn't change stock quantity directly here.
    }

    stmt.run(name, category, newCostPrice, sellingPrice, newQuantity, lowStockThreshold || oldProduct.low_stock_threshold, id);
    res.json({ message: 'Product updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating product' });
  }
});

app.delete('/api/products/:id', authenticateToken, (req: any, res) => {
  if (req.user.role !== 'ADMIN') return res.sendStatus(403);
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
});

// --- CUSTOMER ROUTES ---

app.get('/api/customers/search', authenticateToken, (req: any, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  
  const customers = db.prepare(`
    SELECT * FROM customers 
    WHERE name LIKE ? OR phone LIKE ? 
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`);
  
  res.json(customers);
});

// --- SALES ROUTES ---

app.post('/api/sales', authenticateToken, (req: any, res) => {
  const { customerName, customerPhone, paymentMethod, items } = req.body; // items: [{ productId, quantity, unitPrice }]
  const userId = req.user.id;

  if (!items || items.length === 0) return res.status(400).json({ message: 'No items in sale' });

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  const createSale = db.transaction(() => {
    let totalAmount = 0;

    // Calculate total first
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    // Handle Customer
    if (customerName && customerPhone) {
      const existingCustomer: any = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customerPhone);
      if (existingCustomer) {
        // Update name if changed? Let's keep original for now or update it.
        // db.prepare('UPDATE customers SET name = ? WHERE id = ?').run(customerName, existingCustomer.id);
      } else {
        db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customerName, customerPhone);
      }
    }

    // Insert Sale
    const saleResult = db.prepare(`
      INSERT INTO sales (invoice_number, user_id, customer_name, customer_phone, total_amount, payment_method)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(invoiceNumber, userId, customerName, customerPhone, totalAmount, paymentMethod);

    const saleId = saleResult.lastInsertRowid;

    // Process Items
    for (const item of items) {
      const product: any = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
      
      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (product.quantity < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

      // Deduct Stock
      db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(item.quantity, item.productId);

      // Record Sale Item
      db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(saleId, item.productId, item.quantity, item.unitPrice, product.cost_price, item.quantity * item.unitPrice);
      
      if (item.unitPrice !== product.selling_price) {
         db.prepare(`
            INSERT INTO price_logs (product_id, old_price, new_price, changed_by_user_id)
            VALUES (?, ?, ?, ?)
         `).run(item.productId, product.selling_price, item.unitPrice, userId);
      }
    }

    return { saleId, invoiceNumber, totalAmount };
  });

  try {
    const result = createSale();
    res.status(201).json(result);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/sales', authenticateToken, (req: any, res) => {
  if (req.user.role === 'ADMIN') {
    const sales = db.prepare(`
      SELECT s.*, u.full_name as staff_name 
      FROM sales s 
      JOIN users u ON s.user_id = u.id 
      ORDER BY s.created_at DESC
    `).all();
    res.json(sales);
  } else {
    const sales = db.prepare(`
      SELECT s.*, u.full_name as staff_name 
      FROM sales s 
      JOIN users u ON s.user_id = u.id 
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.id);
    res.json(sales);
  }
});

app.get('/api/sales/:id', authenticateToken, (req, res) => {
    const saleId = req.params.id;
    const sale = db.prepare(`
        SELECT s.*, u.full_name as staff_name 
        FROM sales s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.id = ?
    `).get(saleId);

    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const items = db.prepare(`
        SELECT si.*, p.name as product_name 
        FROM sale_items si 
        JOIN products p ON si.product_id = p.id 
        WHERE si.sale_id = ?
    `).all(saleId);

    res.json({ ...sale, items });
});

// --- DASHBOARD ROUTES ---

app.get('/api/dashboard/stats', authenticateToken, (req: any, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  const today = new Date().toISOString().split('T')[0];
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date();
  startOfMonth.setDate(1);

  // Helper queries
  const getSalesSum = (whereClause: string, params: any[]) => {
    const result: any = db.prepare(`SELECT SUM(total_amount) as total FROM sales WHERE ${whereClause}`).get(...params);
    return result.total || 0;
  };

  const getCount = (whereClause: string, params: any[]) => {
      const result: any = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE ${whereClause}`).get(...params);
      return result.count || 0;
  };

  const userFilter = isAdmin ? '1=1' : 'user_id = ?';
  const userParams = isAdmin ? [] : [userId];

  const stats = {
    todaySales: getSalesSum(`${userFilter} AND date(created_at) = date('now')`, userParams),
    weekSales: getSalesSum(`${userFilter} AND date(created_at) >= date(?, 'start of day')`, [...userParams, startOfWeek.toISOString()]), // SQLite date logic is tricky, simplifying
    monthSales: getSalesSum(`${userFilter} AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`, userParams),
    totalRevenue: getSalesSum(userFilter, userParams),
    totalInvoices: getCount(userFilter, userParams)
  };

  if (isAdmin) {
    // Admin extra stats
    const totalProfitResult: any = db.prepare(`
      SELECT SUM((si.unit_price - si.cost_price) * si.quantity) as profit 
      FROM sale_items si
    `).get();
    
    const stockValueResult: any = db.prepare(`
      SELECT SUM(cost_price * quantity) as value FROM products
    `).get();

    const paymentMethods = db.prepare(`
      SELECT payment_method, SUM(total_amount) as total
      FROM sales
      GROUP BY payment_method
    `).all();

    res.json({
      ...stats,
      totalProfit: totalProfitResult.profit || 0,
      stockValue: stockValueResult.value || 0,
      paymentMethods
    });
  } else {
    res.json(stats);
  }
});

app.get('/api/dashboard/price-logs', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    
    const logs = db.prepare(`
        SELECT pl.*, p.name as product_name, u.full_name as staff_name
        FROM price_logs pl
        JOIN products p ON pl.product_id = p.id
        JOIN users u ON pl.changed_by_user_id = u.id
        ORDER BY pl.changed_at DESC
        LIMIT 50
    `).all();
    
    res.json(logs);
});


// Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
