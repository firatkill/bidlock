begin;
select no_plan();
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock.ensure_public_auction() as aid \gset
select is((select status from bidlock.auctions where id=:'aid'), 'live', 'TC-094 first public auction live');
select is(bidlock.ensure_public_auction(), :'aid'::uuid, 'TC-095 repeated ensure returns same id');
select bidlock_test.auction() as second_id \gset
select throws_ok(format('update bidlock.auctions set kind=%L where id=%L', 'public', :'second_id'), '23505', null, 'TC-096 second open public auction rejected');
select is((select starting_price from bidlock.auctions where id=:'aid'), 1000::bigint, 'TC-099 public starting price');
select is((select ends_at-starts_at from bidlock.auctions where id=:'aid'), interval '5 minutes', 'TC-099 public duration');
select is((select sandbox_id from bidlock.auctions where id=:'aid'), null::uuid, 'TC-099 no sandbox');
select bidlock_test.set_now('2026-01-01 12:05:00+00');
select bidlock.ensure_public_auction() as next_id \gset
select isnt(:'next_id'::uuid, :'aid'::uuid, 'TC-097 next lot differs');
select is((select status from bidlock.auctions where id=:'next_id'), 'scheduled', 'TC-097 next lot scheduled');
select is((select starts_at from bidlock.auctions where id=:'next_id'), '2026-01-01 12:05:15+00'::timestamptz, 'TC-097 fifteen-second gap');
select bidlock_test.set_now('2026-01-01 12:05:15+00');
select is(bidlock.ensure_public_auction(), :'next_id'::uuid, 'TC-097 same lot starts lazily');
select is((select status from bidlock.auctions where id=:'next_id'), 'live', 'TC-097 next lot now live');
select is(bidlock.auction_state(:'aid',null)->>'next_public_auction_id',:'next_id','TC-098 finished public state links next lot');
select * from finish();
rollback;
