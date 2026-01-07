# models/bank.py

class Bank:
    def __init__(self, bank_name):
        self.bank_name = bank_name
        # A dictionary to store customers using their ID as the key
        self.customers = {}

    def add_customer(self, customer):
        """Registers a new Customer object into the bank's system."""
        self.customers[customer.customer_id] = customer

    def find_account(self, account_number):
        """Searches through all customers to find a specific account."""
        for customer in self.customers.values():
            for account in customer.accounts:
                if account.account_number == account_number:
                    return account
        return None

    def get_all_customers(self):
        """Returns a list of all registered customers."""
        return list(self.customers.values())

    # --- ADD THIS NEW METHOD BELOW ---
    def search_customers(self, query):
        """
        Filters customers by matching the name or ID.
        Returns a list of matching Customer objects.
        """
        if not query:
            return self.get_all_customers()
        
        query = query.lower() # Make search case-insensitive
        results = []
        
        for customer in self.customers.values():
            # Check if query exists in name or ID
            if query in customer.name.lower() or query in customer.customer_id.lower():
                results.append(customer)
                
        return results
