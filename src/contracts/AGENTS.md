# Contracts Contributor Guide

Each file here solves a coding contract. The puzzle text is kept as a block comment at the top, followed by a `solve` function that returns the answer. Exporting this function lets the unit tests and other scripts reuse it.

The main entry writes the solution to a port so that `src/fetch-contracts.ts` can run solvers by name. JSDoc is not required in these files; keep the code short and match the contract name with the filename.
