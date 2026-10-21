begin;
select plan(3);
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction() as aid \gset
select bidlock_test.set_now('2026-01-01 12:06:00+00');
select bidlock.advance_auction_locked(a, bidlock.bidlock_now()) from bidlock.auctions a where id = :'aid';
select is((select status from bidlock.auctions where id = :'aid'), 'unsold', 'TC-067 DB-07 no-bid auction becomes unsold');
select is((select payment_state from bidlock.auctions where id = :'aid'), null, 'TC-067 DB-07 no payment state without bids');
select is((select closed_at from bidlock.auctions where id = :'aid'), '2026-01-01 12:05:00+00'::timestamptz, 'TC-067 DB-07 logical close time');
select * from finish();
rollback;
