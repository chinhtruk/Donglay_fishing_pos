<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_dashboard_reports_collected_and_outstanding_amounts(): void
    {
        Carbon::setTestNow('2026-06-21 12:00:00');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'manager']);

        $paid = Order::create([
            'order_number' => 'CF-PAID01',
            'service_type' => 'coffee',
            'opened_by' => $admin->id,
            'status' => 'paid',
            'subtotal' => 100000,
            'total' => 100000,
        ]);
        Payment::create([
            'payment_number' => 'PM-PAID01',
            'order_id' => $paid->id,
            'cashier_id' => $admin->id,
            'amount' => 100000,
            'cash_received' => 100000,
            'change_due' => 0,
            'status' => 'completed',
            'paid_at' => now(),
        ]);
        Order::create([
            'order_number' => 'FS-OPEN01',
            'service_type' => 'fishing',
            'opened_by' => $admin->id,
            'status' => 'open',
            'subtotal' => 200000,
            'total' => 200000,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard?from=2026-06-21&to=2026-06-21')
            ->assertOk()
            ->assertJsonPath('metrics.collected_revenue', '100000.00')
            ->assertJsonPath('metrics.outstanding_amount', '200000.00')
            ->assertJsonPath('metrics.paid_order_count', 1)
            ->assertJsonPath('metrics.attention_order_count', 1)
            ->assertJsonPath('status_counts.open', 1)
            ->assertJsonPath('status_counts.paid', 1)
            ->assertJsonCount(1, 'daily');

        Carbon::setTestNow();
    }

    public function test_admin_navigation_contains_management_but_not_pos_operations(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'manager']);

        $this->actingAs($admin)
            ->get('/admin/dashboard')
            ->assertOk()
            ->assertSee('/admin/orders', false)
            ->assertSee('QUẢN LÝ')
            ->assertDontSee('VẬN HÀNH')
            ->assertDontSee('/pos/coffee', false)
            ->assertDontSee('/pos/fishing', false);
    }

    public function test_admin_order_index_can_filter_by_service_type_and_status(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'manager']);
        $spot = FishingSpot::create(['label' => 'Chòi 20']);
        $table = CoffeeTable::create(['label' => 'Bàn 2']);

        Order::create([
            'order_number' => 'FS-OPEN01',
            'service_type' => 'fishing',
            'fishing_spot_id' => $spot->id,
            'opened_by' => $admin->id,
            'status' => 'open',
            'subtotal' => 200000,
            'total' => 200000,
        ]);
        Order::create([
            'order_number' => 'CF-OPEN01',
            'service_type' => 'coffee',
            'coffee_table_id' => $table->id,
            'opened_by' => $admin->id,
            'status' => 'open',
            'subtotal' => 30000,
            'total' => 30000,
        ]);
        Order::create([
            'order_number' => 'FS-PAID01',
            'service_type' => 'fishing',
            'opened_by' => $admin->id,
            'status' => 'paid',
            'subtotal' => 200000,
            'total' => 200000,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/orders?service_type=fishing&status=open')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'FS-OPEN01')
            ->assertJsonPath('data.0.service_type', 'fishing')
            ->assertJsonPath('data.0.status', 'open');

        $this->actingAs($admin)
            ->getJson('/api/v1/orders?q='.rawurlencode('Chòi 20'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'FS-OPEN01');
    }

    public function test_admin_menu_index_can_filter_by_category_and_search(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'manager']);
        $coffee = MenuCategory::create(['name' => 'Cà phê', 'sort_order' => 1, 'is_active' => true]);
        $snacks = MenuCategory::create(['name' => 'Ăn vặt', 'sort_order' => 2, 'is_active' => true]);

        MenuItem::create(['category_id' => $coffee->id, 'category' => $coffee->name, 'name' => 'Cà phê đen', 'price' => 20000, 'is_available' => true]);
        MenuItem::create(['category_id' => $coffee->id, 'category' => $coffee->name, 'name' => 'Bạc xỉu', 'price' => 25000, 'is_available' => true]);
        MenuItem::create(['category_id' => $snacks->id, 'category' => $snacks->name, 'name' => 'Khoai tây chiên', 'price' => 30000, 'is_available' => true]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/menu?category='.rawurlencode('Cà phê').'&q='.rawurlencode('đen'))
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.name', 'Cà phê đen')
            ->assertJsonPath('items.0.category', 'Cà phê');
    }

    public function test_dashboard_does_not_treat_partial_payment_as_completed_order(): void
    {
        Carbon::setTestNow('2026-06-21 12:00:00');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'manager']);
        $order = Order::create([
            'order_number' => 'CF-PART01',
            'service_type' => 'coffee',
            'opened_by' => $admin->id,
            'status' => 'partially_paid',
            'subtotal' => 150000,
            'total' => 150000,
        ]);
        Payment::create([
            'payment_number' => 'PM-PART01',
            'order_id' => $order->id,
            'cashier_id' => $admin->id,
            'amount' => 50000,
            'cash_received' => 50000,
            'change_due' => 0,
            'status' => 'completed',
            'paid_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard?from=2026-06-21&to=2026-06-21')
            ->assertOk()
            ->assertJsonPath('metrics.collected_revenue', '50000.00')
            ->assertJsonPath('metrics.paid_order_count', 0)
            ->assertJsonPath('metrics.outstanding_amount', '100000.00')
            ->assertJsonPath('status_counts.partially_paid', 1);

        Carbon::setTestNow();
    }

    public function test_void_metrics_follow_void_date_instead_of_order_creation_date(): void
    {
        Carbon::setTestNow('2026-06-21 12:00:00');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'manager']);
        $order = Order::create([
            'order_number' => 'CF-VOID01',
            'service_type' => 'coffee',
            'opened_by' => $admin->id,
            'status' => 'void',
            'subtotal' => 75000,
            'total' => 75000,
            'voided_at' => now(),
            'void_reason' => 'Khách đổi ý',
        ]);
        $order->forceFill(['created_at' => now()->subDays(3), 'updated_at' => now()])->save();

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard?from=2026-06-21&to=2026-06-21')
            ->assertOk()
            ->assertJsonPath('metrics.voided_revenue', '75000.00')
            ->assertJsonCount(1, 'recent_voids');

        Carbon::setTestNow();
    }
}
