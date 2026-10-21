-- Shared contention/load verifier. D-47 rejects UNKNOWN payment-state predicates.
with a as (select * from bidlock.auctions where id = $1),
     b as (select * from bidlock.bids where auction_id = $1),
     o as (select b.*, lag(amount) over w as prev_amount_seq, lag(bidder_id) over w as prev_bidder,
                  lag(bid_no) over w as prev_no
             from b window w as (order by bid_no))
select 'INV-01' as id, 'leader is the bidder of the highest bid' as check, count(*)::int as violations
  from a where a.leader_bidder_id is distinct from (select bidder_id from b order by amount desc limit 1)
union all
select 'INV-02', 'current_price equals max accepted amount', count(*)::int
  from a where a.current_price is distinct from (select max(amount) from b)
union all
select 'INV-03a', 'bid_no is 1..n without gaps', count(*)::int from o where bid_no <> coalesce(prev_no, 0) + 1
union all
select 'INV-03b', 'each bid meets start or previous + increment', count(*)::int
  from o cross join a
 where (o.prev_amount_seq is null and o.amount < a.starting_price)
    or (o.prev_amount_seq is not null and o.amount < o.prev_amount_seq + bidlock.increment_for(o.prev_amount_seq))
union all
select 'INV-04', 'no consecutive bids by the same bidder', count(*)::int from o where bidder_id = prev_bidder
union all
select 'INV-05', 'every bid placed before ends_at at that moment', count(*)::int from b where placed_at >= ends_at_before
union all
select 'INV-06', 'no bid at or after the logical close', count(*)::int
  from b cross join a where a.closed_at is not null and b.placed_at >= a.closed_at
union all
select 'INV-07a', 'one request row per (bidder, key)', count(*)::int
  from (select 1 from bidlock.bid_requests where auction_id = $1 group by bidder_id, idempotency_key having count(*) > 1) x
union all
select 'INV-07b', 'every bid has exactly one accepted request', count(*)::int
  from b left join bidlock.bid_requests r on r.id = b.request_id where r.id is null or r.outcome <> 'accepted'
union all
select 'INV-07c', 'every accepted request has a bid', count(*)::int
  from bidlock.bid_requests r where r.auction_id = $1 and r.outcome = 'accepted'
   and not exists (select 1 from b where b.request_id = r.id)
union all
select 'INV-08a', 'extension_count within cap and equal to extension rows', count(*)::int
  from a where a.extension_count > a.max_extensions
            or a.extension_count <> (select count(*) from bidlock.auction_extensions e where e.auction_id = $1)
union all
select 'INV-08b', 'extensions move ends_at forward', count(*)::int
  from bidlock.auction_extensions e where e.auction_id = $1 and e.new_ends_at <= e.old_ends_at
union all
select 'INV-10', 'at most one open and one paid offer; settled iff one paid offer', count(*)::int
  from a where (select count(*) from bidlock.offers where auction_id = $1 and status = 'open') > 1
            or (select count(*) from bidlock.offers where auction_id = $1 and status = 'paid') > 1
            or ((a.status = 'settled') <> exists (select 1 from bidlock.offers where auction_id = $1 and status = 'paid'))
union all
select 'INV-11', 'runner-up offer goes to another bidder at their own highest bid', count(*)::int
  from bidlock.offers r
  join bidlock.offers w on w.auction_id = r.auction_id and w.rank = 1
 where r.auction_id = $1 and r.rank = 2
   and (r.bidder_id = w.bidder_id
        or r.amount <> (select max(amount) from b where b.bidder_id = r.bidder_id))
union all
select 'INV-12', 'bid_count equals accepted bids', count(*)::int from a where a.bid_count <> (select count(*) from b)
union all
select 'INV-13', 'valid status / payment_state pair', count(*)::int
  from a where ((a.status in ('scheduled','live') and a.payment_state is null)
                 or (a.status = 'closed' and a.payment_state in ('awaiting_payment','offered_to_runner_up'))
                 or (a.status = 'settled' and a.payment_state = 'paid')
                 or (a.status = 'unsold' and (a.payment_state is null or a.payment_state = 'expired'))) is not true
order by 1;
