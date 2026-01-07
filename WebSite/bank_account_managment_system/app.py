from flask import Flask, render_template, request, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
app.secret_key = 'bank_secret_key'

# Database Setup
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- MODELS (Database Tables) ---

class Account(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(20), unique=True, nullable=False)
    account_holder = db.Column(db.String(100), nullable=False)
    balance = db.Column(db.Float, default=0.0)
    acc_type = db.Column(db.String(20))
    
    transactions = db.relationship('Transaction', backref='account', lazy=True)

    # Add this so your HTML {{ account.get_balance() }} works!
    def get_balance(self):
        return self.balance

    def deposit(self, amount):
        if amount > 0:
            self.balance += amount
            return True
        return False

    def withdraw(self, amount):
        if 0 < amount <= self.balance:
            self.balance -= amount
            return True
        return False

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50))
    amount = db.Column(db.Float)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    balance_after = db.Column(db.Float) # Add this column
    account_id = db.Column(db.Integer, db.ForeignKey('account.id'), nullable=False)

# --- ROUTES ---

@app.route('/')
def index():
    search_query = request.args.get('search', '')
    if search_query:
        # Database Search Query
        accounts = Account.query.filter(
            (Account.account_holder.contains(search_query)) | 
            (Account.account_number.contains(search_query))
        ).all()
    else:
        accounts = Account.query.all()
    return render_template('index.html', accounts=accounts, search_query=search_query)

@app.route('/create_customer', methods=['GET', 'POST'])
def create_customer():
    if request.method == 'POST':
        name = request.form.get('name')
        acc_num = request.form.get('acc_num')
        acc_type = request.form.get('acc_type')
        balance = float(request.form.get('balance', 0))

        # Save to Database
        new_acc = Account(account_number=acc_num, account_holder=name, balance=balance, acc_type=acc_type)
        db.session.add(new_acc)
        db.session.commit()
        
        flash(f"Account created for {name}!", "success")
        return redirect(url_for('index'))
    return render_template('create_customer.html')

@app.route('/deposit/<acc_num>', methods=['GET', 'POST'])
def deposit(acc_num):
    account = Account.query.filter_by(account_number=acc_num).first()
    if request.method == 'POST':
        amount = float(request.form.get('amount'))
        if account.deposit(amount):
            # Record Transaction
            tx = Transaction(type="Deposit", amount=amount, account_id=account.id)
            db.session.add(tx)
            db.session.commit() # Permanent Save
            flash("Deposit Successful!", "success")
            return redirect(url_for('index'))
    return render_template('deposit.html', account=account)

@app.route('/withdraw/<acc_num>', methods=['GET', 'POST'])
def withdraw(acc_num):
    account = Account.query.filter_by(account_number=acc_num).first()
    if request.method == 'POST':
        amount = float(request.form.get('amount'))
        if account.withdraw(amount):
            tx = Transaction(type="Withdrawal", amount=-amount, account_id=account.id)
            db.session.add(tx)
            db.session.commit() # Permanent Save
            flash("Withdrawal Successful!", "success")
            return redirect(url_for('index'))
        else:
            flash("Insufficient Funds!", "danger")
    return render_template('withdraw.html', account=account)

@app.route('/transactions/<acc_num>')
def transactions(acc_num):
    account = Account.query.filter_by(account_number=acc_num).first()
    return render_template('transactions.html', account=account)

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Yeh line khud hi database.db bana degi
    app.run(debug=True)
