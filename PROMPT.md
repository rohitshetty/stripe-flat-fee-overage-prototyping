I want to build a prototype to validate my assumptions on using stripe for an integration into the project. 
Basically, I want to use stripe's managed ui system, stripe checkout - to build my subscription. 
It should work as follows:
1. User has default Tiers (Example starter, expert, pro)
2. Each level will give user N "credits", say 
  Start: 1 credit for 10$
  Expert: 5 credit for 15$
  Pro: 10 credit for 20$
3. User selects their tier and buys it in the stripe checkout - this should be a subscription. Basically, if user selects Starter, then they should get charged 10$ per month, with 1 action per month.
4. This will unlock user to perform certain action (Say click a button that says "click here"), each click will consume 1 credit. We need our system (backend) to know if user can perform the action or not, and how many are left etc - we likely also want the data in our backend about how many credit user has, how many left etc.
5. After credit is over, user can buy addons. 
6. User should also be able to trial this for N days at the starter level
7. Handle edge cases, like user cancels subscription mid month, and has credits left. Or upgrades/downgrades - what happens. Think of more edge cases.


Help me build a simple system, say in nextjs, to validate these assumptions - and provide me tools to test this along with guide on how to setup stripe to do this in test mode. Keep all the tools simple and boring (Example - use sqlite for this instead of postgres) - write raw sql, instead of orm. Use tailwind to create a simple, visually coherent UI (Document the UI design philosophy if we are creating more than 1 page/view). 

We don't need user auth or management - but backend should still use a user for these, assume that all actions are being performed by the same user. Just provide tooling to clear everything and restart so i can test various scenarios. 

Keep the code organized, really simple and modular - aim towards human readability, as I will use this to understand stripe's features.
Follow all standard and best practices for such implementation. 

Provide me with tooling to test this locally - including subscription somehow. 

Keep this local, and easy to run for demo.
