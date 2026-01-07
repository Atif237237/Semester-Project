import sqlite3
from database import get_db

class Transaction:
    def __init__(self, transaction_id=None, account_id=None, type=None, amount=None, timestamp=None):
        self.transaction_id = transaction_id
        self.account_id = account_id
        self.type = type
        self.amount = amount
        self.timestamp = timestamp

    @classmethod
    def create(cls, account_id, type, amount):
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO transactions (account_id, type, amount, timestamp) VALUES (?, ?, ?, ?)",
                       (account_id, type, amount, timestamp))
        conn.commit()
        transaction_id = cursor.lastrowid
        conn.close()
        return cls(transaction_id, account_id, type, amount, timestamp)

    @classmethod
    def get_by_account(cls, account_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions WHERE account_id = ?", (account_id,))
        transactions = cursor.fetchall()
        conn.close()
        return [cls(transaction_id=t[0], account_id=t[1], type=t[2], amount=t[3], timestamp=t[4]) for t in transactions]
