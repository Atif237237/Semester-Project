# models/customer.py

class Customer:
    def __init__(self, name, customer_id):
        self.name = name
        self.customer_id = customer_id
        # Association: This list will hold Account objects (Savings or Current)
        self.accounts = []

    def add_account(self, account_obj):
        """Links an Account object to this customer."""
        self.accounts.append(account_obj)

    def get_total_balance(self):
        """Calculates total wealth across all accounts owned by this customer."""
        total = sum(acc.get_balance() for acc in self.accounts)
        return total

    def __str__(self):
        """Returns a user-friendly string representation of the customer."""
        return f"Customer: {self.name} (ID: {self.customer_id}) | Accounts: {len(self.accounts)}"
