I want to build a prototype to validate my assumptions on using stripe for an integration into the project. 
Basically, I want to use stripe's managed ui system, stripe checkout - to build my subscription. 
It should work as follows:
There is only 1 tier, but it is for monthly or yearly. 
Each user will need to purchase one of these two. It is a subscription based system. 
Monthly plan is 250$ and gives you 100 clicks per month. Unused clicks can be carried over to next month (50 clicks can be carried over at most)
Yearly plan is $5000 and gives you 2500 clicks per year. No rollover. 
There is a top up available for each plan, where $150 buys you 50 clicks - these never expire and can be used whenever we want. 
Users can also "Pause" their subscription.
