import pandas as pd
from django_pandas.io import read_frame
from sklearn.neighbors import NearestNeighbors
from django.contrib.auth import get_user_model
from .models import Event, EventCategory, Order, OrderDetail, Review, EventTrend

User = get_user_model()

class RecommendationEngine:
    def __init__(self):
        self.events_df = None
        self.user_history_df = None
        self.load_data()

    def load_data(self):
        events = Event.objects.filter(status='upcoming')
        self.events_df = read_frame(events, fieldnames=['id', 'category__name', 'location', 'date'])
        self.events_df.columns = ['event_id', 'category', 'location', 'date']

        orders = Order.objects.filter(payment_status='paid')
        order_details = OrderDetail.objects.filter(order__in=orders)
        self.user_history_df = read_frame(order_details, fieldnames=['order__user__id', 'ticket__event__id', 'quantity'])
        self.user_history_df.columns = ['user_id', 'event_id', 'quantity']

    def get_user_preferences(self, user_id):
        user_events = self.user_history_df[self.user_history_df['user_id'] == user_id]
        if user_events.empty:
            return []
        event_ids = user_events['event_id'].tolist()
        past_events = Event.objects.filter(id__in=event_ids)
        categories = past_events.values_list('category__name', flat=True).distinct()
        return list(categories)

    def simple_recommendation(self, user_id, max_results=5):
        preferences = self.get_user_preferences(user_id)
        user = User.objects.get(id=user_id)
        user_location = user.address or ""

        if not preferences:
            trending_events = EventTrend.objects.order_by('-interest_level')[:max_results]
            return Event.objects.filter(id__in=[t.event_id for t in trending_events])

        recommended = Event.objects.filter(
            category__name__in=preferences,
            location__icontains=user_location,
            status='upcoming'
        )[:max_results]
        return recommended

    def prepare_ml_data(self):
        events = Event.objects.filter(status='upcoming')
        event_features = []
        for event in events:
            category = event.category.name if event.category else "Unknown"
            views = EventTrend.objects.filter(event=event).first().views if EventTrend.objects.filter(
                event=event).exists() else 0
            interest = EventTrend.objects.filter(event=event).first().interest_level if EventTrend.objects.filter(
                event=event).exists() else 0
            event_features.append({
                'event_id': event.id,
                'category': category,
                'views': views,
                'interest': interest
            })

        df = pd.DataFrame(event_features)
        df_encoded = pd.get_dummies(df[['category']], prefix='cat')
        df_final = pd.concat([df[['event_id', 'views', 'interest']], df_encoded], axis=1)
        return df_final

    def ml_recommendation(self, user_id, max_results=5):
        preferences = self.get_user_preferences(user_id)
        if not preferences:
            trending_events = EventTrend.objects.order_by('-interest_level')[:max_results]
            return Event.objects.filter(id__in=[t.event_id for t in trending_events])

        df = self.prepare_ml_data()
        X = df.drop('event_id', axis=1).values
        n_samples = X.shape[0]
        n_neighbors = min(max_results, n_samples)

        if n_samples == 0:
            trending_events = EventTrend.objects.order_by('-interest_level')[:max_results]
            return Event.objects.filter(id__in=[t.event_id for t in trending_events])

        knn = NearestNeighbors(n_neighbors=n_neighbors, metric='cosine')
        knn.fit(X)
        user_vector = pd.DataFrame([0] * len(X[0]), index=df.columns[1:]).T
        for pref in preferences:
            if f'cat_{pref}' in user_vector.columns:
                user_vector[f'cat_{pref}'] = 1

        distances, indices = knn.kneighbors(user_vector.values)
        recommended_event_ids = df.iloc[indices[0]]['event_id'].tolist()
        recommended = Event.objects.filter(id__in=recommended_event_ids).order_by('-trends__interest_level')
        return recommended