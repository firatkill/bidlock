# M3 live browser review — TC-208

Local production build, APP_ENV=test, polling feed. No production traffic. Use a fresh test auction and independent Chrome/Brave guest sessions. Reset any test clock offset in cleanup.

| Surface                  | Action                                        | Expected                                                                              |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Own room in two browsers | Place a quick bid in each                     | Other browser updates price/leader and outbid state; history keeps both bids          |
| Own room countdown       | Observe countdown then server-confirmed close | Time decreases from server clock; controls disable at close; no client-created winner |
| Own room at 360px        | Inspect price, bid controls and history       | Readable with no overlap or horizontal overflow                                       |
| Name dialog              | Open, cancel                                  | Focus returns to Edit; bidding remains usable                                         |
| Runtime                  | Inspect browser console                       | No app errors                                                                         |

Must remain unchanged: integer prices, minimum increments, independently authenticated guests, exact copy, disabled sandbox creation and empty benchmark state. Hosted Supabase Broadcast delivery is outside this local polling review.
