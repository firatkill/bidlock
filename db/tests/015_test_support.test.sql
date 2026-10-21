begin;
select no_plan();
select set_config('bidlock.now_override','',true);
update bidlock.settings set env='test',test_clock_offset_ms=0;
select bidlock.create_test_auction() as aid \gset
select is((select kind from bidlock.auctions where id=:'aid'),'test','TC-120 creates test auction');
select bidlock.set_test_clock(60000);
select is((select test_clock_offset_ms from bidlock.settings),60000::bigint,'TC-120 offset stored');
select ok(abs(extract(epoch from bidlock.bidlock_now()-clock_timestamp())-60)<1,'TC-120 test offset applied');
update bidlock.settings set env='prod',test_clock_offset_ms=0;
select throws_ok('select bidlock.create_test_auction()','BLK30','test support function called outside test env','TC-121 production refuses test auction');
select throws_ok('select bidlock.set_test_clock(1000)','BLK30','test support function called outside test env','TC-121 production refuses clock');
select * from finish();
rollback;
