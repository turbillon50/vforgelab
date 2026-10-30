# Hackathon delivery checklist

Updated 2026-10-30. Event: Nebius × NVIDIA Global AI Hackathon.

Official sources:
- https://nebiusglobalaihackathon.devpost.com/rules
- https://nebiusglobalaihackathon.devpost.com/

Deadline: October 30, 2026, 10:00 AM PDT / 17:00 UTC / 11:00 AM Mexico City /
12:00 PM Cancun.

## Implemented and verified

- [x] Independent application backend and own PostgreSQL data store.
- [x] Real NVIDIA model call on Nebius Token Factory, with nonempty output.
- [x] Persistent conversations, explicit memory and inference traces.
- [x] Public source repository: https://github.com/turbillon50/vforgelab
- [x] MIT license.
- [x] Source code and reproducible setup/run instructions.
- [x] README documenting the actual NVIDIA model and Nebius integration.
- [x] English project description, significant changes and tool feedback drafted.
- [x] Automated tests and live database/model verification recorded in VERIFICATION.md.

## Remaining submission work

- [ ] Verify the public user-facing demo/test-build URL.
- [ ] Select the track in Devpost; Best Apps and Agents matches this backend.
- [ ] Publish and verify a public YouTube demo of three minutes or less.
- [ ] Finalize English materials or translations for the actual submitted client and video.
- [ ] Complete and submit Devpost, then verify the confirmation.
- [ ] Maintain the judge access required by the official rules.

## Current implementation scope

Luis authorized a separate NVIDIA-powered VForgeLab with its application and LLM
database. That backend is implemented and verified. The Telegram frontend is
being handled separately; its integration contract is INTEGRATION.md and API.md.
Public deployment, video publication and submission are not claimed by this
checklist. The required Nebius/NVIDIA runtime integration is already real.
