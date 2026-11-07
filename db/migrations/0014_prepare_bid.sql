-- Commit identity and rate checking before the separate place_bid statement (D-90).
-- p_bot_id is supplied only after the server verifies the scoped bot token.
create or replace function bidlock.prepare_bid(
  p_session_bidder_id uuid, p_bot_id uuid, p_ip_hash text
) returns jsonb
language plpgsql volatile security definer set search_path = bidlock, pg_temp as $$
declare
  v_retry integer;
  v_bidder uuid;
begin
  if bidlock.get_me(p_session_bidder_id) is null then
    return jsonb_build_object('kind', 'error', 'error_code',
      case when p_bot_id is null then 'NO_SESSION' else 'BOT_TOKEN_INVALID' end,
      'retry_after_ms', null);
  end if;
  v_bidder := coalesce(p_bot_id, p_session_bidder_id);
  v_retry := bidlock.check_bid_rate(v_bidder, p_ip_hash);
  if v_retry > 0 then
    return jsonb_build_object('kind', 'error', 'error_code', 'RATE_LIMITED', 'retry_after_ms', v_retry);
  end if;
  return jsonb_build_object('kind', 'ready', 'bidder_id', v_bidder);
end $$;
revoke execute on all functions in schema bidlock from public;
grant execute on function bidlock.prepare_bid(uuid, uuid, text) to bidlock_app;
