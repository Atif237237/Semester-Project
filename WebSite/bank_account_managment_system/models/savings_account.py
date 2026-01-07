# models/savings_account.py
from models.account import Account

class SavingsAccount(Account):
    def __init__(self, account_number, account_holder, initial_balance=0.0, interest_rate=0.02):
        # Call the parent (Account) constructor to set basic details
        super().__init__(account_number, account_holder, initial_balance)
        self.interest_rate = interest_rate

    def apply_interest(self):
        """Calculates interest and deposits it into the account."""
        interest_amount = self.get_balance() * self.interest_rate
        self.deposit(interest_amount)
        return interest_amount
