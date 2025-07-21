# Services Contributor Guide

This directory contains daemon scripts that expose functionality through a port-based messaging protocol. Each service listens on a well-known port and responds to structured messages sent by client scripts. Consumers use the companion classes in `services/client/` which wrap the messaging details.

The daemon–client pattern and message formats are documented in `DISCOVER_SPEC.md`. Follow the established request/response protocol when adding new services so they integrate with the standard helper utilities.
