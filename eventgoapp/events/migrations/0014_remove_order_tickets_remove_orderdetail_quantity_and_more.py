
import cloudinary.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0013_orderdetail_google_calendar_event_id_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='order',
            name='tickets',
        ),
        migrations.RemoveField(
            model_name='orderdetail',
            name='quantity',
        ),
        migrations.AddField(
            model_name='order',
            name='expiration_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='quantity',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='order',
            name='ticket',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='orders', to='events.ticket'),
        ),
        migrations.AlterField(
            model_name='event',
            name='organizer',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='organized_events', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='event',
            name='ticket_limit',
            field=models.PositiveIntegerField(blank=True, default=0, null=True),
        ),
        migrations.AlterField(
            model_name='order',
            name='payment_method',
            field=models.CharField(blank=True, choices=[('MoMo', 'MoMo'), ('VNPAY', 'VNPAY'), ('credit_card', 'Credit Card')], max_length=20, null=True),
        ),
        migrations.AlterField(
            model_name='orderdetail',
            name='qr_image',
            field=cloudinary.models.CloudinaryField(blank=True, max_length=255, null=True, verbose_name='image'),
        ),
    ]