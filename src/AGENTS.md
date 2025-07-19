# Minimizing Netscript RAM Usage

Each Netscript function has a RAM cost noted in its JSDoc comments.
Bitburner decides how much memory a script needs by scanning the text
of that script and any modules it imports. The scanner simply looks for
API function names. If the name appears anywhere—even in comments or in
unused functions—its RAM cost is added to the total.

This means that importing a module brings in the cost of **every** NS
function used in that module, regardless of which parts of it you
actually call. Mentioning an API function in a comment can also inflate
the cost.

To keep RAM usage low:

1. Avoid referencing NS APIs you do not use.
2. Keep modules small and focused so that imported files contain only
   the APIs you need.
3. Be careful when documenting code; quoting NS function names may raise
   the calculated cost.

Following these guidelines will prevent unused APIs from counting
against your script's RAM budget.
