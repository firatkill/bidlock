# M5 live review plan

Read the settlement change and its adjacent lobby/profile code before review. Direct surfaces: result panel, simulated Pay/Retry, offer notices and strike refresh. Adjacent surfaces: bid controls, history, name chip, public successor link. SQL settlement rules and API authorization remain unchanged; automation covers their existing contracts.

| Route / role                       | Action                                                     | Expected                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Own local test auction / winner    | Bid, watch closing countdown and resulting offer, then pay | Bid controls replaced by exact won/payment copy; amount matches accepted bid; paid confirmation follows real POST |
| Own local test auction / runner-up | Bid before another test bidder; let winner expire          | Offer is at runner's own highest bid; exact body and usable payment button                                        |
| Same room / mobile                 | Inspect at 360px and pay                                   | No overlap or horizontal overflow; amount/deadline readable; paid confirmation                                    |
| Lobby / offer recipient            | Return with open offer                                     | Notice links to correct auction; profile identity retained                                                        |
| Room / any                         | Inspect console/network and history                        | No hydration/API failures; bids remain readable and ordered                                                       |

TC-236 records only observed live evidence. If the transient Closing frame is not captured, record that limit explicitly; do not infer it from automated component tests. Restore the global test clock and viewport, close only QA-created tabs and stop the QA server after review. No production traffic.

## Observed evidence

Chrome local production polling build: Bidder 8126 bid $10 on Lot 18, observed the countdown and winner panel after natural close, then paid successfully. Lot 19 used the same browser bidder at $10 and a separate local API-created guest at $11; the test clock opened and expired the winner offer. The browser showed the second-chance offer at its own $10 bid, paid successfully, and retained both history rows. At 360×740 the panel was readable and document scrollWidth/clientWidth were both 345px. Screenshot: evidence/M5-mobile.jpg. Browser error/warning log was empty; local pay requests completed successfully. No real payment or production traffic.

Synthetic server-clock jumps can retain an earlier lowest-RTT clock sample by the documented ClockSync design; the initial runner view showed 5:54 until reload established a fresh sample (then 2:09 remaining). This is fixture discontinuity, not a changed production clock rule. E2E-05 reloads after its injected jump and before bidding; its countdown assertion remains 0:29/0:30.

The transient Closing… frame was not captured: natural countdown-to-winner transitions were observed on Lots 18 and 20, but observations missed that brief intermediate frame. Keep TC-236 partially verified/manual-required for that visual subcheck; deterministic countdown DOM coverage remains green. Viewport restored, both QA tabs closed, test clock reset, QA server stopped.
