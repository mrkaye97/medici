use crate::handlers;
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(paths(
    handlers::list_members_of_pool_handler,
    handlers::list_pools_for_member_handler,
    handlers::get_member_handler,
    handlers::signup_handler,
    handlers::login_handler,
    handlers::authenticate_handler,
    handlers::create_pool_handler,
    handlers::get_pool_details_handler,
    handlers::create_pool_membership_handler,
    handlers::add_friend_to_pool_handler,
    handlers::remove_friend_from_pool_handler,
    handlers::add_expense_handler,
    handlers::get_expense_handler,
    handlers::get_pool_recent_expenses_handler,
    handlers::list_friends_handler,
    handlers::list_inbound_friend_requests_handler,
    handlers::create_friend_request_handler,
    handlers::accept_friend_request_handler,
))]
pub struct ApiDoc;
