import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const API_BASE = Constants.expoConfig?.extra?.API_BASE || "http://127.0.0.1:8000/";

export const endpoints = {
  // Auth endpoints
  login: API_BASE + "o/token/",
  register: API_BASE + "users/",
  currentUser: API_BASE + "users/current-user/",
  updateUser: API_BASE + "users/update-current-user/",

  // Event endpoints
  events: API_BASE + "events/",
  eventDetail: (id) => API_BASE + `events/${id}/detail/`,
  eventAnalytics: (eventId) => API_BASE + `events/${eventId}/analytics/`,
  dashboardAnalytics: API_BASE + "events/dashboard-analytics/",
  analyticsFilterOptions: API_BASE + "reviews/analytics-filter-options/",
  ticketsOfEvent: (id) => API_BASE + `events/${id}/tickets/`,
  createOrder: (id) => API_BASE + `events/${id}/create-order/`,
  recommendedEvents: API_BASE + "events/recommended/",
  trendingEvents: API_BASE + "events/trending/",
  searchEvents: API_BASE + "events/search-events/",
  createEvent: API_BASE + "events/create/",
  createTicket: (eventId) => API_BASE + `events/${eventId}/tickets/create/`,
  updateTicket: (eventId, ticketId) =>
    API_BASE + `events/${eventId}/tickets/${ticketId}/update/`,
  deleteTicket: (eventId, ticketId) =>
    API_BASE + `events/${eventId}/tickets/${ticketId}/delete/`,
  eventCategories: API_BASE + "event-categories/",
  discounts: (id) => API_BASE + `events/${id}/discounts/`,
  discountsCheck: (id) => API_BASE + `events/${id}/check-discount/`,
  updateEvent: (eventId) => API_BASE + `events/${eventId}/update/`,
  cancelEvent: (eventId) => API_BASE + `events/${eventId}/cancel/`,
  payOrder: (id) => API_BASE + `orders/${id}/pay/`,
  checkInTicket: (eventId) => `/events/${eventId}/checkin/`,
  orders: API_BASE + "orders/",
  // User related endpoints
  myTickets: API_BASE + "users/my-tickets/",
  myRank: API_BASE + "users/my-rank/",
  myNotifications: API_BASE + "users/my-notifications/",
  markNotificationRead: (id) =>
    API_BASE + `users/mark-notification-read/${id}/`,
  markAllNotificationsRead: API_BASE + "users/mark-all-notifications-read/",
  pushToken: API_BASE + "users/push-token/",

  // Ticket endpoints
  checkIn: (orderDetailId) =>
    API_BASE + `orders/details/${orderDetailId}/checkin/`,
  // Review endpoints
  submitReview: (eventId) => API_BASE + `events/${eventId}/review/`,
  eventReviews: (eventId) => API_BASE + `reviews/by-event/${eventId}/`,
  myReviews: API_BASE + "reviews/my-reviews/",
  deleteReview: (reviewId) => API_BASE + `reviews/${reviewId}/`,
  replyToReview: (eventId, reviewId) =>
    API_BASE + `events/${eventId}/reviews/${reviewId}/reply/`,
};

export const authApis = (token) => {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 10000,
  });
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export { API_BASE };
export default api;
