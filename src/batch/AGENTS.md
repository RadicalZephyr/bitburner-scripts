# Contributor Guide

## Development Instructions

 * Any function that calculates a number of threads to run must always
   return an integer value.
 * Grow and weaken thread calculations should always be rounded up
   with `Math.ceil`.
