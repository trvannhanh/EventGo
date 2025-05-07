import axios from "axios";

export const API_BASE = 'http://192.168.1.41:8000/';

export const endpoints = {
    // Auth endpoints
    login: API_BASE + "auth/login/",
    register: API_BASE + "users/",
    currentUser: API_BASE + "users/current-user/",
    updateUser: API_BASE + "users/update-current-user/",
    
    // Event endpoints
    events: API_BASE + "events/",
    eventDetail: (id) => API_BASE + `events/${id}/detail/`,
    ticketsOfEvent: (id) => API_BASE + `events/${id}/tickets/`,
    bookTicket: (id) => API_BASE + `events/${id}/book-ticket/`,
    recommendedEvents: API_BASE + "events/recommended/",
    trendingEvents: API_BASE + "events/trending/",
    searchEvents: API_BASE + "events/search-events/",
    createEvent: API_BASE + "events/create/",
    createTicket: (eventId) => API_BASE + `events/${eventId}/tickets/create/`,
    eventCategories: API_BASE + "events/categories/",
    
    // User related endpoints
    myTickets: API_BASE + "users/my-tickets/",
    myRank: API_BASE + "users/my-rank/",
    
    // Ticket endpoints
    // Updated to match backend implementation (should be a ticket/order detail endpoint)
    checkIn: (orderDetailId) => API_BASE + `orders/details/${orderDetailId}/checkin/`,
    
    // Review endpoints
    submitReview: (eventId) => API_BASE + `events/${eventId}/review/`,
    eventReviews: (eventId) => API_BASE + `events/${eventId}/feedback/`,
    myReviews: API_BASE + "reviews/my-reviews/",
    deleteReview: (reviewId) => API_BASE + `reviews/${reviewId}/`,
}

export const authApis = (token) => {
    return axios.create({
        baseURL: API_BASE,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
}

export default axios.create({
    baseURL: API_BASE
})