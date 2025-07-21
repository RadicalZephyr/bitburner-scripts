# Util Contributor Guide

Helpers in this folder are small and focused. Most files export a single function or two and try to avoid Netscript dependencies so that importing them adds minimal RAM cost.

When you do need Netscript functions, use as few as possible and avoid pulling in unrelated APIs. Keeping these modules lean lets higher level scripts include them without increasing memory usage.
