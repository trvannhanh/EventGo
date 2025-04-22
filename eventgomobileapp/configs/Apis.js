import axios from "axios";

export const API_BASE = 'http://192.168.1.41:8000/';

export const endpoints = {
    login: API_BASE + "auth/login/",
    register: API_BASE + "users/",
    events: API_BASE + "events/",
    eventDetail: (id) => API_BASE + `events/${id}/`,
    bookTicket: (id) => API_BASE + `events/${id}/book/`,
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