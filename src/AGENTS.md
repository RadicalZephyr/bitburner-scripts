# Netscript API Object Usage and Costs

Every method in the Netscript API has a RAM cost specified in GB in
the JSDoc `@remarks` tagged like this: `RAM cost: 1 GB`.

The Bitburner runtime uses a static RAM check that analyzes script
files in a simplistic way to determine how much RAM a script requires
to run. The algorithm for the static RAM checker is basically a simple
search in the script file for instances of `NS` function names.

This check is extremely simple and prone to false positives, for
instance mentioning the function name in a comment will cause the
static RAM checker to assume the script is using that function and
will increase the script's RAM cost accordingly. This same simplistic
RAM check is done recursively on all files a script imports with no
regard for what NS API elements are used in the specific functions or
classes a script has imported.

This means that if a library module contains two functions using
different NS APIs and we import and use only one function, our scripts
RAM usage will be still be increased by the static RAM checker for all
the NS APIs used in the function we didn't use.

Because of this, we prefer to use small focused modules that use as
minimal a set of netscript APIs as possible.
