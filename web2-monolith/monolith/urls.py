from django.urls import path
from monolith import views

urlpatterns = [
    path('', views.index_view, name='index'),
    path('api/produk', views.get_all_produk, name='all_produk'),
    path('api/produk/<int:produk_id>', views.get_produk_by_id, name='produk_detail'),
    path('api/order', lambda request: views.create_order(request) if request.method == 'POST' else views.get_all_orders(request), name='orders'),
    path('api/order/sync', views.create_order_sync, name='order_sync'),
    path('api/order/async', views.create_order_async, name='order_async'),
    path('api/order/status/<str:job_id>', views.get_job_status, name='job_status'),
]
