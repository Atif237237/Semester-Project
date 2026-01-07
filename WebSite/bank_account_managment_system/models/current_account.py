# models/current_account.py
from models.account import Account

class CurrentAccount(Account):
    def __init__(self, account_number, account_holder, initial_balance=0.0):
        # Current accounts usually have 0% or very low interest
        super().__init__(account_number, account_holder, initial_balance)
        self.interest_rate = 0.005 

    def apply_interest(self):
        """Polymorphism: Different math logic than SavingsAccount."""
        # Let's say Current accounts get a flat bonus if balance > 5000
        if self.get_balance() > 5000:
            bonus = 10.0
            self.deposit(bonus)
            return bonus
        return 0.0
