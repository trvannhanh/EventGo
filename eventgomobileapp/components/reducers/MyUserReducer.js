import AsyncStorage from "@react-native-async-storage/async-storage";

export default (current, action) => {
    switch (action.type) {
        case "LOGIN":
            return action.payload;
        case "LOGOUT":
            AsyncStorage.removeItem("token");
            return null;
    }
    return current;
}