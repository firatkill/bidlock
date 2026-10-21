begin;
select no_plan();
select bidlock_test.clean();
select bidlock_test.set_now('2026-01-01 12:00:00+00');
select bidlock_test.auction(snipe => 0) as aid, bidlock_test.bidder() as b1, bidlock_test.bidder() as b2 \gset
select results_eq(format('select jsonb_object_keys(bidlock.auction_state(%L,%L)) order by 1', :'aid', :'b1'), array['bid_count','closed_at','current_price','ends_at','expired_offers','extend_by_s','extension_count','id','increment','kind','last_extension','leader','lot_no','max_bid','max_extensions','min_next_bid','next_public_auction_id','offer','original_ends_at','payment_state','sandbox','server_now','settled_at','snipe_window_s','starting_price','starts_at','status','title','version'], 'TC-100 exact state keys');
select bidlock_test.bid(:'aid', :'b1',1000);
select bidlock_test.bid(:'aid', :'b2',1100);
select bidlock_test.bid(:'aid', :'b1',1200);
select bidlock_test.bid(:'aid', :'b2',1300);
select bidlock_test.bid(:'aid', :'b1',1400);
create temporary table newest as select bidlock.list_bids(:'aid',:'b1',null,null,2) as r;
create temporary table cursor as select bidlock.list_bids(:'aid',:'b1',4,null,2) as r;
create temporary table last as select bidlock.list_bids(:'aid',:'b1',2,null,2) as r;
create temporary table gap as select bidlock.list_bids(:'aid',:'b1',null,2,2) as r;
select is((select array_agg((x->>'bid_no')::integer) from newest,jsonb_array_elements(r->'bids') x), array[5, 4]::integer[], 'TC-102 newest order');
select is((select array_agg((x->>'bid_no')::integer) from cursor,jsonb_array_elements(r->'bids') x), array[3, 2]::integer[], 'TC-102 cursor order');
select is((select array_agg((x->>'bid_no')::integer) from last,jsonb_array_elements(r->'bids') x), array[1]::integer[], 'TC-102 last order');
select is((select array_agg((x->>'bid_no')::integer) from gap,jsonb_array_elements(r->'bids') x), array[3, 4]::integer[], 'TC-102 gap order');
select is((select r->>'next_cursor' from newest),'4','TC-102 newest cursor');
select is((select r->>'next_cursor' from last),null,'TC-102 final cursor null');
insert into bidlock.sandboxes(owner_id,bot_seed,created_at,expires_at) values (:'b1',1,bidlock.bidlock_now(),bidlock.bidlock_now()+interval '15 minutes') returning id as sid \gset
select bidlock_test.auction() as sandbox_aid \gset
update bidlock.auctions set kind='sandbox',sandbox_id=:'sid' where id=:'sandbox_aid';
insert into bidlock.bidders(display_name,is_bot,bot_persona,sandbox_id) values ('Read bot',true,'steady',:'sid') returning id as bot \gset
select is(bidlock.auction_state(:'sandbox_aid',:'b2'),null::jsonb,'TC-101 sandbox hidden from stranger');
select is(bidlock.list_bids(:'sandbox_aid',:'b2',null,null,10),null::jsonb,'TC-101 history hidden from stranger');
select is(bidlock.get_me(:'bot'),null::jsonb,'TC-104 bot has no profile');
select is(bidlock.get_me(:'b1')->'active_sandbox'->>'sandbox_id', :'sid','TC-103 active sandbox returned');
select bidlock_test.auction(snipe => 0,pay_window => 30) as short_aid, bidlock_test.auction(snipe => 0) as long_aid \gset
select bidlock_test.bid(:'short_aid',:'b1',1000);
select bidlock_test.bid(:'long_aid',:'b1',1000);
select bidlock_test.set_now('2026-01-01 12:05:00+00');
select bidlock.advance_auction_locked(a,bidlock.bidlock_now()) from bidlock.auctions a where id in (:'short_aid',:'long_aid');
select bidlock_test.set_now('2026-01-01 12:05:30+00');
select is(jsonb_array_length(bidlock.get_me(:'b1')->'open_offers'),1,'TC-103 hides expired open offers');
select is(bidlock.get_me(:'b1')->'open_offers'->0->>'auction_id',:'long_aid','TC-103 only future deadline returned');
select is((select status from bidlock.offers where auction_id=:'short_aid'),'open','TC-103 profile read does not mutate expired offer');
select is((bidlock.stats()->>'bids_today')::bigint,7::bigint,'TC-105 bids today count');
select is((bidlock.stats()->>'active_sandboxes')::bigint,1::bigint,'TC-105 active sandbox count');
select bidlock.ensure_public_auction();
select is((bidlock.stats()->>'public_lots_today')::bigint,1::bigint,'TC-105 public lot count');
select * from finish();
rollback;
