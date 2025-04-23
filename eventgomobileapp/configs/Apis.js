import axios from "axios";

export const API_BASE = 'http://10.17.50.147:8000/';

export const endpoints = {
    login: API_BASE + "auth/login/",
    register: API_BASE + "users/",
    events: API_BASE + "events/",
    eventDetail: (id) => API_BASE + `events/${id}/detail/`,
    ticketsOfEvent: (id) => API_BASE + `booking/${id}/tickets/`,
    bookTicket: (id) => API_BASE + `booking/${id}/book-ticket/`,
    myTickets: API_BASE + "tickets/my/",
    checkIn: (ticketId) => API_BASE + `tickets/${ticketId}/checkin/`,
    review: (eventId) => API_BASE + `events/${eventId}/review/`,
    
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