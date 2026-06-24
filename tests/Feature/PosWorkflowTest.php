<?php

namespace Tests\Feature;

use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\PaymentQrSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PosWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_coffee_order_supports_split_then_final_payment(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 1', 'position_x' => 10, 'position_y' => 10]);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê sữa', 'price' => 30000, 'is_available' => true]);

        $created = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", ['items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]]])->assertCreated()->json('order');
        $line = $created['items'][0];
        $first = $this->postJson("/api/v1/coffee/orders/{$created['id']}/checkout", ['version' => $created['version'], 'cash_received' => 50000, 'items' => [['order_item_id' => $line['id'], 'quantity' => 1]]])->assertOk()->json('order');
        $this->assertSame('partially_paid', $first['status']);
        $this->assertSame(1, $first['items'][0]['paid_quantity']);
        $this->postJson("/api/v1/coffee/orders/{$created['id']}/checkout", ['version' => $first['version'], 'cash_received' => 30000, 'items' => [['order_item_id' => $line['id'], 'quantity' => 1]]])->assertOk()->assertJsonPath('order.status', 'paid');
    }

    public function test_stale_order_version_is_rejected_softly(): void
    {
        $employee = User::factory()->create();
        $table = CoffeeTable::create(['label' => 'Bàn 2']);
        $item = MenuItem::create(['category' => 'Trà', 'name' => 'Trà đào', 'price' => 35000, 'is_available' => true]);
        $order = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", ['items' => [['menu_item_id' => $item->id, 'quantity' => 1]]])->json('order');
        $this->putJson("/api/v1/coffee/orders/{$order['id']}", ['version' => $order['version'] - 1, 'items' => [['menu_item_id' => $item->id, 'quantity' => 2]]])->assertStatus(409);
    }

    public function test_order_index_prioritizes_recent_order_activity(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $firstTable = CoffeeTable::create(['label' => 'Bàn 1']);
        $secondTable = CoffeeTable::create(['label' => 'Bàn 2']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Bạc xỉu', 'price' => 30000, 'is_available' => true]);

        Carbon::setTestNow('2026-06-24 09:00:00');

        try {
            $firstOrder = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$firstTable->id}/orders", [
                'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
            ])->assertCreated()->json('order');

            Carbon::setTestNow('2026-06-24 10:00:00');
            $this->postJson("/api/v1/coffee/tables/{$secondTable->id}/orders", [
                'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
            ])->assertCreated();

            Carbon::setTestNow('2026-06-24 11:00:00');
            $this->putJson("/api/v1/coffee/orders/{$firstOrder['id']}", [
                'version' => $firstOrder['version'],
                'items' => [['menu_item_id' => $item->id, 'quantity' => 2]],
            ])->assertOk();

            $this->getJson('/api/v1/orders')
                ->assertOk()
                ->assertJsonPath('data.0.id', $firstOrder['id'])
                ->assertJsonPath('data.0.resource.label', 'Bàn 1')
                ->assertJsonPath('data.0.opened_at', '2026-06-24T09:00:00+07:00')
                ->assertJsonPath('data.0.activity_at', '2026-06-24T11:00:00+07:00');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_order_items_expose_ordered_at_for_staff_order_grouping(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 4']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Bạc xỉu', 'price' => 30000, 'is_available' => true]);

        Carbon::setTestNow('2026-06-24 08:15:00');

        try {
            $created = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
                'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
            ])->assertCreated()
                ->assertJsonPath('order.items.0.ordered_at', '2026-06-24T08:15:00+07:00')
                ->json('order');

            Carbon::setTestNow('2026-06-24 09:30:00');
            $updated = $this->putJson("/api/v1/coffee/orders/{$created['id']}", [
                'version' => $created['version'],
                'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]],
            ])->assertOk()->json('order');

            $items = collect($updated['items'])->sortBy('ordered_at')->values();
            $this->assertCount(2, $items);
            $this->assertSame($coffee->id, $items[0]['menu_item_id']);
            $this->assertSame(1, $items[0]['quantity']);
            $this->assertSame('2026-06-24T08:15:00+07:00', $items[0]['ordered_at']);
            $this->assertSame($coffee->id, $items[1]['menu_item_id']);
            $this->assertSame(1, $items[1]['quantity']);
            $this->assertSame('2026-06-24T09:30:00+07:00', $items[1]['ordered_at']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_counter_order_can_stay_unassigned_and_receive_a_table_later(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 5']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Bạc xỉu', 'price' => 42000, 'is_available' => true]);

        $order = $this->actingAs($employee)->postJson('/api/v1/coffee/orders', [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()->assertJsonPath('order.resource', null)->json('order');

        $assigned = $this->putJson("/api/v1/coffee/orders/{$order['id']}/table", [
            'version' => $order['version'],
            'coffee_table_id' => $table->id,
        ])->assertOk()->assertJsonPath('order.resource.label', 'Bàn 5')->json('order');

        $this->putJson("/api/v1/coffee/orders/{$order['id']}/table", [
            'version' => $assigned['version'],
            'coffee_table_id' => null,
        ])->assertOk()->assertJsonPath('order.resource', null);
    }

    public function test_counter_order_cannot_be_assigned_to_an_occupied_table(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 6']);
        $item = MenuItem::create(['category' => 'Trà', 'name' => 'Trà sen', 'price' => 39000, 'is_available' => true]);

        $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated();
        $counter = $this->postJson('/api/v1/coffee/orders', [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');

        $this->putJson("/api/v1/coffee/orders/{$counter['id']}/table", [
            'version' => $counter['version'],
            'coffee_table_id' => $table->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('table');
    }

    public function test_fishing_session_can_extend_and_checkout_as_a_whole(): void
    {
        $employee = User::factory()->create();
        $spot = FishingSpot::create(['label' => 'Chòi 1']);
        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');
        $this->assertSame('200000.00', $order['total']);
        $extended = $this->postJson("/api/v1/fishing/orders/{$order['id']}/extend", ['version' => $order['version']])->assertOk()->json('order');
        $this->assertSame('400000.00', $extended['total']);
        $this->assertSame(2, $extended['fishing_session']['blocks_count']);
        $this->postJson("/api/v1/fishing/orders/{$order['id']}/checkout", ['version' => $extended['version'], 'cash_received' => 500000])->assertOk()->assertJsonPath('order.status', 'paid');
    }

    public function test_fishing_session_can_extend_by_multiple_session_blocks(): void
    {
        $employee = User::factory()->create();
        $spot = FishingSpot::create(['label' => 'Chòi 2']);
        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');

        $extended = $this->postJson("/api/v1/fishing/orders/{$order['id']}/extend", [
            'version' => $order['version'],
            'blocks' => 3,
        ])->assertOk()
            ->assertJsonPath('message', 'Đã gia hạn thêm 3 phiên câu.')
            ->json('order');

        $this->assertSame('800000.00', $extended['total']);
        $this->assertSame(4, $extended['fishing_session']['blocks_count']);
        $this->assertSame(4, collect($extended['items'])->firstWhere('line_type', 'fishing_session')['quantity']);
    }

    public function test_fishing_session_can_extend_by_hourly_fee(): void
    {
        Carbon::setTestNow('2026-06-24 08:00:00');

        try {
            $employee = User::factory()->create();
            $spot = FishingSpot::create(['label' => 'Chòi 9']);
            $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');

            $extended = $this->postJson("/api/v1/fishing/orders/{$order['id']}/extend", [
                'version' => $order['version'],
                'mode' => 'hour',
                'hours' => 2,
            ])->assertOk()
                ->assertJsonPath('message', 'Đã gia hạn thêm 2 giờ.')
                ->json('order');

            $hourlyLine = collect($extended['items'])->firstWhere('line_type', 'hourly_extension');
            $this->assertSame('300000.00', $extended['total']);
            $this->assertSame(1, $extended['fishing_session']['blocks_count']);
            $this->assertSame('2026-06-24T14:00:00+07:00', $extended['fishing_session']['ends_at']);
            $this->assertSame('Gia hạn 2 giờ', $hourlyLine['name']);
            $this->assertSame('100000.00', $hourlyLine['unit_price']);
            $this->assertSame(1, $hourlyLine['quantity']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_expired_fishing_session_extension_restarts_countdown_from_confirm_time(): void
    {
        Carbon::setTestNow('2026-06-24 08:00:00');

        try {
            $employee = User::factory()->create();
            $spot = FishingSpot::create(['label' => 'Chòi 4']);
            $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');
            $session = Order::findOrFail($order['id'])->fishingSession;
            $session->update([
                'ends_at' => Carbon::parse('2026-06-24 07:30:00'),
                'status' => 'expired',
                'expired_notified_at' => Carbon::parse('2026-06-24 07:30:00'),
            ]);

            $extended = $this->postJson("/api/v1/fishing/orders/{$order['id']}/extend", [
                'version' => $order['version'],
                'blocks' => 1,
            ])->assertOk()->json('order');

            $this->assertSame('active', $extended['fishing_session']['status']);
            $this->assertSame('2026-06-24T12:00:00+07:00', $extended['fishing_session']['ends_at']);
            $this->assertSame(2, $extended['fishing_session']['blocks_count']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_paid_expired_fishing_session_can_be_extended_before_release(): void
    {
        Carbon::setTestNow('2026-06-24 08:00:00');

        try {
            $employee = User::factory()->create(['role' => 'employee']);
            $spot = FishingSpot::create(['label' => 'Chòi 20']);

            $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');
            $paid = $this->postJson("/api/v1/fishing/orders/{$order['id']}/checkout", [
                'version' => $order['version'],
                'cash_received' => 200000,
            ])->assertOk()->json('order');

            $session = Order::findOrFail($order['id'])->fishingSession;
            $session->update([
                'ends_at' => Carbon::parse('2026-06-24 07:30:00'),
                'status' => 'expired',
                'expired_notified_at' => Carbon::parse('2026-06-24 07:30:00'),
            ]);

            $extended = $this->postJson("/api/v1/fishing/orders/{$order['id']}/extend", [
                'version' => $paid['version'],
                'blocks' => 1,
            ])->assertOk()->json('order');

            $sessionLine = collect($extended['items'])->firstWhere('line_type', 'fishing_session');
            $this->assertSame('partially_paid', $extended['status']);
            $this->assertSame('400000.00', $extended['total']);
            $this->assertSame(2, $sessionLine['quantity']);
            $this->assertSame(1, $sessionLine['paid_quantity']);
            $this->assertSame('active', $extended['fishing_session']['status']);
            $this->assertSame('2026-06-24T12:00:00+07:00', $extended['fishing_session']['ends_at']);
            $this->assertNull($extended['completed_at']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_fishing_session_can_order_beverages_and_checkout_together(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $spot = FishingSpot::create(['label' => 'Chòi 3']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê đá', 'price' => 25000, 'is_available' => true]);

        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');
        $this->assertSame('200000.00', $order['total']);

        $updated = $this->putJson("/api/v1/fishing/orders/{$order['id']}", [
            'version' => $order['version'],
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]]
        ])->assertOk()->json('order');

        $this->assertSame('250000.00', $updated['total']);
        $this->assertCount(2, $updated['items']);

        $extended = $this->postJson("/api/v1/fishing/orders/{$order['id']}/extend", [
            'version' => $updated['version']
        ])->assertOk()->json('order');

        $this->assertSame('450000.00', $extended['total']);

        $checkoutResult = $this->postJson("/api/v1/fishing/orders/{$order['id']}/checkout", [
            'version' => $extended['version'],
            'cash_received' => 500000
        ])->assertOk()->json('order');

        $this->assertSame('paid', $checkoutResult['status']);
        foreach ($checkoutResult['items'] as $item) {
            $this->assertEquals($item['quantity'], $item['paid_quantity']);
        }
    }

    public function test_fishing_session_with_empty_items_can_be_updated_and_checked_out(): void
    {
        $employee = User::factory()->create();
        $spot = FishingSpot::create(['label' => 'Chòi 4']);
        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');

        $updated = $this->putJson("/api/v1/fishing/orders/{$order['id']}", [
            'version' => $order['version'],
            'items' => []
        ])->assertOk()->json('order');

        $this->assertSame('200000.00', $updated['total']);
        $this->assertCount(1, $updated['items']);
        $this->assertSame('fishing_session', $updated['items'][0]['line_type']);

        $this->postJson("/api/v1/fishing/orders/{$order['id']}/checkout", [
            'version' => $updated['version'],
            'cash_received' => 200000
        ])->assertOk()->assertJsonPath('order.status', 'paid');
    }

    public function test_coffee_order_checkout_with_release_flag_releases_table_automatically(): void
    {
        $employee = User::factory()->create();
        $table = CoffeeTable::create(['label' => 'Bàn 5']);
        $item = MenuItem::create(['category' => 'Nước', 'name' => 'Cà phê đá', 'price' => 20000, 'is_available' => true]);
        
        $order = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]]
        ])->assertCreated()->json('order');

        $checkoutResult = $this->postJson("/api/v1/coffee/orders/{$order['id']}/checkout", [
            'version' => $order['version'],
            'cash_received' => 20000,
            'release' => true
        ])->assertOk()->json('order');

        $this->assertSame('paid', $checkoutResult['status']);
        $this->assertNotNull($checkoutResult['completed_at']);
    }

    public function test_coffee_order_can_checkout_with_qr_payment_method(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn QR']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê QR', 'price' => 40000, 'is_available' => true]);
        PaymentQrSetting::create(['is_enabled' => true, 'qr_image_path' => 'payment-qr/sample.png']);

        $order = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');

        $response = $this->postJson("/api/v1/coffee/orders/{$order['id']}/checkout", [
            'version' => $order['version'],
            'payment_method' => 'qr',
        ])->assertOk();

        $response->assertJsonPath('payment.method', 'qr')
            ->assertJsonPath('payment.cash_received', '40000.00')
            ->assertJsonPath('payment.change_due', '0.00')
            ->assertJsonPath('order.status', 'paid');
    }

    public function test_admin_can_configure_qr_payment_for_pos_checkout(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $response = $this->actingAs($admin)->post('/api/v1/admin/payment-settings', [
            'is_enabled' => '1',
            'bank_name' => 'Vietcombank',
            'account_name' => 'DONG LAY FISHING',
            'account_number' => '123456789',
            'transfer_note' => 'DONG LAY',
            'extra_info' => 'Dua man hinh thanh toan thanh cong cho nhan vien xac nhan.',
            'qr_image' => UploadedFile::fake()->image('qr.png', 900, 900),
        ])->assertOk();

        $setting = PaymentQrSetting::firstOrFail();
        Storage::disk('public')->assertExists($setting->qr_image_path);

        $response
            ->assertJsonPath('qr.is_enabled', true)
            ->assertJsonPath('qr.bank_name', 'Vietcombank')
            ->assertJsonPath('qr.account_name', 'DONG LAY FISHING')
            ->assertJsonPath('qr.account_number', '123456789')
            ->assertJsonPath('qr.transfer_note', 'DONG LAY')
            ->assertJsonPath('qr.qr_image_url', '/storage/'.$setting->qr_image_path);

        $this->getJson('/api/v1/coffee/map')
            ->assertOk()
            ->assertJsonPath('payment_settings.qr.is_enabled', true)
            ->assertJsonPath('payment_settings.qr.qr_image_url', '/storage/'.$setting->qr_image_path);
    }

    public function test_admin_can_add_payment_method_and_pos_can_checkout_with_it(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn QR 2']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Bạc xỉu QR', 'price' => 45000, 'is_available' => true]);

        $methodResponse = $this->actingAs($admin)->post('/api/v1/admin/payment-methods', [
            'name' => 'VietinBank QR',
            'type' => 'qr',
            'is_enabled' => '1',
            'bank_name' => 'VietinBank',
            'account_name' => 'DONG LAY FISHING',
            'account_number' => '987654321',
            'transfer_note' => 'DONG LAY',
            'qr_image' => UploadedFile::fake()->image('qr-vietin.png', 900, 900),
        ])->assertCreated();

        $code = $methodResponse->json('method.code');
        $this->assertSame('qr_2', $code);

        $this->actingAs($employee)
            ->getJson('/api/v1/coffee/map')
            ->assertOk()
            ->assertJsonPath('payment_settings.methods.1.code', $code)
            ->assertJsonPath('payment_settings.methods.1.name', 'VietinBank QR');

        $order = $this->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');

        $this->postJson("/api/v1/coffee/orders/{$order['id']}/checkout", [
            'version' => $order['version'],
            'payment_method' => $code,
        ])->assertOk()
            ->assertJsonPath('payment.method', $code)
            ->assertJsonPath('payment.cash_received', '45000.00')
            ->assertJsonPath('payment.change_due', '0.00')
            ->assertJsonPath('order.status', 'paid');
    }

    public function test_fishing_order_checkout_with_release_flag_releases_spot_automatically(): void
    {
        $employee = User::factory()->create();
        $spot = FishingSpot::create(['label' => 'Chòi 6']);
        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');

        $checkoutResult = $this->postJson("/api/v1/fishing/orders/{$order['id']}/checkout", [
            'version' => $order['version'],
            'cash_received' => 200000,
            'release' => true
        ])->assertOk()->json('order');

        $this->assertSame('paid', $checkoutResult['status']);
        $this->assertNotNull($checkoutResult['completed_at']);
        $this->assertSame('completed', Order::find($order['id'])->fishingSession->status);
    }

    public function test_menu_in_an_open_order_cannot_be_deleted(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);
        $table = CoffeeTable::create(['label' => 'Bàn 3']);
        $item = MenuItem::create(['category' => 'Nước', 'name' => 'Nước suối', 'price' => 15000, 'is_available' => true]);
        $this->actingAs($admin)->postJson("/api/v1/coffee/tables/{$table->id}/orders", ['items' => [['menu_item_id' => $item->id, 'quantity' => 1]]]);
        $this->deleteJson("/api/v1/admin/menu/{$item->id}")->assertUnprocessable();
        $this->assertNull($item->fresh()->deleted_at);
    }

    public function test_admin_can_upload_and_replace_a_menu_image(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $created = $this->actingAs($admin)->post('/api/v1/admin/menu', [
            'category' => 'Cà phê',
            'name' => 'Cà phê ảnh',
            'description' => 'Ảnh món thử nghiệm',
            'price' => 35000,
            'is_available' => '1',
            'image' => UploadedFile::fake()->image('coffee.jpg', 800, 600),
        ], ['Accept' => 'application/json'])->assertCreated()->json('item');

        $this->assertNotNull($created['image_url']);
        Storage::disk('public')->assertExists($created['image_path']);

        $updated = $this->post("/api/v1/admin/menu/{$created['id']}", [
            '_method' => 'PUT',
            'category' => 'Cà phê',
            'name' => 'Cà phê ảnh',
            'description' => 'Ảnh mới',
            'price' => 36000,
            'is_available' => '1',
            'image' => UploadedFile::fake()->image('coffee-new.png', 1200, 900),
        ], ['Accept' => 'application/json'])->assertOk()->json('item');

        Storage::disk('public')->assertMissing($created['image_path']);
        Storage::disk('public')->assertExists($updated['image_path']);
    }

    public function test_admin_menu_accepts_portrait_images(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $created = $this->actingAs($admin)->post('/api/v1/admin/menu', [
            'category' => 'Cà phê',
            'name' => 'Ảnh dọc',
            'price' => 35000,
            'is_available' => '1',
            'image' => UploadedFile::fake()->image('portrait.jpg', 900, 1200),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('item');

        Storage::disk('public')->assertExists($created['image_path']);
    }

    public function test_admin_menu_accepts_a_nominal_four_by_three_image_with_small_pixel_difference(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $created = $this->actingAs($admin)->post('/api/v1/admin/menu', [
            'category' => 'Cà phê',
            'name' => 'Đen đá',
            'price' => 30000,
            'is_available' => '1',
            'image' => UploadedFile::fake()->image('den-da.png', 2400, 1792),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('item');

        Storage::disk('public')->assertExists($created['image_path']);
    }

    public function test_admin_menu_image_cannot_exceed_thirty_megabytes(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $this->actingAs($admin)->post('/api/v1/admin/menu', [
            'category' => 'Cà phê',
            'name' => 'Ảnh quá lớn',
            'price' => 35000,
            'is_available' => '1',
            'image' => UploadedFile::fake()->image('large.jpg', 1200, 900)->size(30721),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('image');
    }

    public function test_admin_can_create_a_category_and_multiple_menu_items_at_once(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $response = $this->actingAs($admin)->post('/api/v1/admin/menu/batch', [
            'category_name' => 'Trà trái cây',
            'items' => [
                [
                    'name' => 'Trà đào',
                    'description' => 'Đào tươi',
                    'price' => 35000,
                    'is_available' => '1',
                    'image' => UploadedFile::fake()->image('peach-tea.jpg', 1200, 900),
                ],
                [
                    'name' => 'Trà vải',
                    'description' => null,
                    'price' => 39000,
                    'is_available' => '1',
                ],
            ],
        ], ['Accept' => 'application/json'])->assertCreated();

        $category = MenuCategory::where('name', 'Trà trái cây')->firstOrFail();
        $this->assertCount(2, $response->json('items'));
        $this->assertDatabaseHas('menu_items', ['category_id' => $category->id, 'category' => 'Trà trái cây', 'name' => 'Trà đào']);
        $this->assertDatabaseHas('menu_items', ['category_id' => $category->id, 'category' => 'Trà trái cây', 'name' => 'Trà vải']);
        Storage::disk('public')->assertExists(MenuItem::where('name', 'Trà đào')->firstOrFail()->image_path);
    }

    public function test_admin_can_add_multiple_items_to_an_existing_category(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);
        $category = MenuCategory::create(['name' => 'Đồ ăn', 'sort_order' => 1, 'is_active' => true]);

        $this->actingAs($admin)->postJson('/api/v1/admin/menu/batch', [
            'category_id' => $category->id,
            'items' => [
                ['name' => 'Khoai tây chiên', 'price' => 45000, 'is_available' => true],
                ['name' => 'Mì xào bò', 'price' => 65000, 'is_available' => true],
            ],
        ])->assertCreated();

        $this->assertSame(2, MenuItem::where('category_id', $category->id)->count());
    }

    public function test_invalid_batch_does_not_create_a_partial_menu(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);

        $this->actingAs($admin)->postJson('/api/v1/admin/menu/batch', [
            'category_name' => 'Nhóm chưa hợp lệ',
            'items' => [
                ['name' => 'Món hợp lệ', 'price' => 30000, 'is_available' => true],
                ['name' => '', 'price' => 0, 'is_available' => true],
            ],
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('menu_categories', ['name' => 'Nhóm chưa hợp lệ']);
        $this->assertDatabaseMissing('menu_items', ['name' => 'Món hợp lệ']);
    }

    public function test_menu_form_only_suggests_categories_with_current_items(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin']);
        $visibleCategory = MenuCategory::create(['name' => 'View', 'sort_order' => 1, 'is_active' => true]);
        $archivedCategory = MenuCategory::create(['name' => 'Nhóm cũ', 'sort_order' => 2, 'is_active' => true]);
        MenuItem::create(['category_id' => $visibleCategory->id, 'category' => 'View', 'name' => 'Món hiện tại', 'price' => 50000, 'is_available' => true]);
        $archivedItem = MenuItem::create(['category_id' => $archivedCategory->id, 'category' => 'Nhóm cũ', 'name' => 'Món đã lưu trữ', 'price' => 30000, 'is_available' => false]);
        $archivedItem->delete();

        $categories = $this->actingAs($admin)->getJson('/api/v1/admin/menu')->assertOk()->json('categories');

        $this->assertSame(['View'], collect($categories)->pluck('name')->all());
    }

    public function test_expired_fishing_session_notifies_active_staff_once(): void
    {
        $employee = User::factory()->create();
        $spot = FishingSpot::create(['label' => 'Chòi 9']);
        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->json('order');
        $model = Order::findOrFail($order['id'])->fishingSession;
        $this->assertCount(1, $employee->fresh()->notifications);
        $model->update(['ends_at' => now()->subMinute()]);
        Artisan::call('schedule:run');
        $this->assertSame('expired', $model->fresh()->status);
        $this->assertCount(2, $employee->fresh()->notifications);
        Artisan::call('schedule:run');
        $this->assertCount(2, $employee->fresh()->notifications);
    }

    public function test_notification_polling_syncs_expired_fishing_sessions(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $spot = FishingSpot::create(['label' => 'Chòi 10']);
        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->json('order');
        $session = Order::findOrFail($order['id'])->fishingSession;

        $employee->notifications()->delete();
        $session->update(['ends_at' => now()->subMinute()]);

        $notifications = $this->getJson('/api/v1/notifications?unread=1')
            ->assertOk()
            ->json('notifications');

        $this->assertSame('expired', $session->fresh()->status);
        $this->assertCount(1, $notifications);
        $this->assertSame('fishing_session_expired', $notifications[0]['data']['type']);

        $this->getJson('/api/v1/notifications?unread=1')
            ->assertOk()
            ->assertJsonCount(1, 'notifications');
    }

    public function test_coffee_orders_can_be_merged_successfully(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table1 = CoffeeTable::create(['label' => 'Bàn 1']);
        $table2 = CoffeeTable::create(['label' => 'Bàn 2']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê sữa', 'price' => 30000, 'is_available' => true]);

        $order1 = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table1->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]]
        ])->assertCreated()->json('order');

        $order2 = $this->postJson("/api/v1/coffee/tables/{$table2->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]]
        ])->assertCreated()->json('order');

        $response = $this->postJson("/api/v1/coffee/orders/{$order1['id']}/merge", [
            'version' => $order1['version'],
            'target_table_id' => $table2->id
        ])->assertOk()->json('order');

        $this->assertSame('90000.00', $response['total']);
        $this->assertSame(3, $response['items'][0]['quantity']);
        $this->assertSame('void', Order::find($order1['id'])->status);
    }

    public function test_merge_paid_and_unpaid_coffee_orders_sets_partially_paid_status(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table1 = CoffeeTable::create(['label' => 'Bàn 1']);
        $table2 = CoffeeTable::create(['label' => 'Bàn 2']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê sữa', 'price' => 30000, 'is_available' => true]);

        $order1 = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table1->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]]
        ])->assertCreated()->json('order');
        $checkout1 = $this->postJson("/api/v1/coffee/orders/{$order1['id']}/checkout", [
            'version' => $order1['version'],
            'cash_received' => 30000
        ])->assertOk()->json('order');
        $this->assertSame('paid', $checkout1['status']);

        $order2 = $this->postJson("/api/v1/coffee/tables/{$table2->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]]
        ])->assertCreated()->json('order');
        $this->assertSame('open', $order2['status']);

        $response = $this->postJson("/api/v1/coffee/orders/{$order1['id']}/merge", [
            'version' => $checkout1['version'],
            'target_table_id' => $table2->id
        ])->assertOk()->json('order');

        $this->assertSame('90000.00', $response['total']);
        $this->assertSame('partially_paid', $response['status']);
        $this->assertSame('void', Order::find($order1['id'])->status);
    }

    public function test_counter_order_can_be_merged_into_an_empty_coffee_table(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 7']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Bạc xỉu', 'price' => 25000, 'is_available' => true]);

        $counter = $this->actingAs($employee)->postJson('/api/v1/coffee/orders', [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2]],
        ])->assertCreated()->json('order');

        $response = $this->postJson("/api/v1/coffee/orders/{$counter['id']}/merge", [
            'version' => $counter['version'],
            'target_table_id' => $table->id,
        ])->assertOk()->json('order');

        $this->assertSame('Bàn 7', $response['resource']['label']);
        $this->assertSame('50000.00', $response['total']);
        $this->assertSame($table->id, Order::findOrFail($counter['id'])->coffee_table_id);
    }

    public function test_occupied_coffee_order_can_be_moved_into_an_empty_table_by_merge(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $sourceTable = CoffeeTable::create(['label' => 'Bàn 1']);
        $targetTable = CoffeeTable::create(['label' => 'Bàn 9']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê muối', 'price' => 25000, 'is_available' => true]);

        $order = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$sourceTable->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');

        $response = $this->postJson("/api/v1/coffee/orders/{$order['id']}/merge", [
            'version' => $order['version'],
            'target_table_id' => $targetTable->id,
        ])->assertOk()->json('order');

        $this->assertSame('Bàn 9', $response['resource']['label']);
        $this->assertSame($targetTable->id, Order::findOrFail($order['id'])->coffee_table_id);
    }

    public function test_fishing_orders_can_be_merged_successfully(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $spot1 = FishingSpot::create(['label' => 'Chòi 1']);
        $spot2 = FishingSpot::create(['label' => 'Chòi 2']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê đá', 'price' => 25000, 'is_available' => true]);

        $order1 = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot1->id}/start")->assertCreated()->json('order');
        $order2 = $this->postJson("/api/v1/fishing/spots/{$spot2->id}/start")->assertCreated()->json('order');

        $order1Updated = $this->putJson("/api/v1/fishing/orders/{$order1['id']}", [
            'version' => $order1['version'],
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]]
        ])->assertOk()->json('order');

        $response = $this->postJson("/api/v1/fishing/orders/{$order1['id']}/merge", [
            'version' => $order1Updated['version'],
            'target_spot_id' => $spot2->id
        ])->assertOk()->json('order');

        $this->assertSame('425000.00', $response['total']);
        $this->assertSame('completed', Order::find($order1['id'])->fishingSession->status);
        $this->assertSame('void', Order::find($order1['id'])->status);
    }

    public function test_merge_paid_and_unpaid_fishing_orders_sets_partially_paid_status(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $spot1 = FishingSpot::create(['label' => 'Chòi 1']);
        $spot2 = FishingSpot::create(['label' => 'Chòi 2']);

        // Start session 1 and checkout (making it paid)
        $order1 = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot1->id}/start")->assertCreated()->json('order');
        $checkout1 = $this->postJson("/api/v1/fishing/orders/{$order1['id']}/checkout", [
            'version' => $order1['version'],
            'cash_received' => 200000
        ])->assertOk()->json('order');
        $this->assertSame('paid', $checkout1['status']);

        // Start session 2 (open/unpaid)
        $order2 = $this->postJson("/api/v1/fishing/spots/{$spot2->id}/start")->assertCreated()->json('order');
        $this->assertSame('open', $order2['status']);

        // Merge paid Spot 1 order into unpaid Spot 2 order
        $response = $this->postJson("/api/v1/fishing/orders/{$order1['id']}/merge", [
            'version' => $checkout1['version'],
            'target_spot_id' => $spot2->id
        ])->assertOk()->json('order');

        // Total should equal both sessions (200000 + 200000) = 400000
        $this->assertSame('400000.00', $response['total']);
        $this->assertSame('partially_paid', $response['status']);
        $this->assertSame('completed', Order::find($order1['id'])->fishingSession->status);
        $this->assertSame('void', Order::find($order1['id'])->status);
    }

    public function test_paid_order_remains_active_until_released(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 1']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê sữa', 'price' => 30000, 'is_available' => true]);

        $created = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", ['items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]]])->assertCreated()->json('order');
        $checkout = $this->postJson("/api/v1/coffee/orders/{$created['id']}/checkout", ['version' => $created['version'], 'cash_received' => 30000])->assertOk()->json('order');
        
        $this->assertSame('paid', $checkout['status']);
        $this->assertNull($checkout['completed_at']);

        $map = $this->getJson('/api/v1/coffee/map')->json();
        $this->assertSame('occupied', $map['tables'][0]['state']);

        $released = $this->postJson("/api/v1/coffee/orders/{$created['id']}/release", ['version' => $checkout['version']])->assertOk()->json('order');
        $this->assertNotNull($released['completed_at']);

        $map = $this->getJson('/api/v1/coffee/map')->json();
        $this->assertSame('available', $map['tables'][0]['state']);
    }

    public function test_paid_coffee_order_can_receive_new_unpaid_items_before_release(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 7']);
        $paidItem = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê đen', 'price' => 25000, 'is_available' => true]);
        $newItem = MenuItem::create(['category' => 'Ăn vặt', 'name' => 'Khoai tây chiên', 'price' => 30000, 'is_available' => true]);

        $created = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $paidItem->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');

        $paid = $this->postJson("/api/v1/coffee/orders/{$created['id']}/checkout", [
            'version' => $created['version'],
            'cash_received' => 25000,
        ])->assertOk()->assertJsonPath('order.status', 'paid')->json('order');

        $updated = $this->putJson("/api/v1/coffee/orders/{$created['id']}", [
            'version' => $paid['version'],
            'items' => [
                ['menu_item_id' => $paidItem->id, 'quantity' => 1],
                ['menu_item_id' => $newItem->id, 'quantity' => 1],
            ],
        ])->assertOk()->json('order');

        $items = collect($updated['items'])->keyBy('menu_item_id');
        $this->assertSame('partially_paid', $updated['status']);
        $this->assertSame('55000.00', $updated['total']);
        $this->assertSame(1, $items[$paidItem->id]['paid_quantity']);
        $this->assertSame(0, $items[$newItem->id]['paid_quantity']);
        $this->assertNull($updated['completed_at']);
    }

    public function test_paid_fishing_order_remains_active_until_released(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $spot = FishingSpot::create(['label' => 'Chòi 1']);

        $order = $this->actingAs($employee)->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated()->json('order');
        
        $checkout = $this->postJson("/api/v1/fishing/orders/{$order['id']}/checkout", ['version' => $order['version'], 'cash_received' => 200000])->assertOk()->json('order');
        $this->assertSame('paid', $checkout['status']);
        $this->assertNull($checkout['completed_at']);
        $this->assertSame('active', Order::find($order['id'])->fishingSession->status);

        $map = $this->getJson('/api/v1/fishing/map')->json();
        $this->assertSame('occupied', $map['spots'][0]['state']);

        $released = $this->postJson("/api/v1/fishing/orders/{$order['id']}/release", ['version' => $checkout['version']])->assertOk()->json('order');
        $this->assertNotNull($released['completed_at']);
        $this->assertSame('completed', Order::find($order['id'])->fishingSession->status);

        $map = $this->getJson('/api/v1/fishing/map')->json();
        $this->assertSame('available', $map['spots'][0]['state']);
    }

    public function test_order_items_can_have_notes(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 12']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê sữa', 'price' => 30000, 'is_available' => true]);

        // Create Coffee order with a note
        $created = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1, 'note' => 'không đá']]
        ])->assertCreated()->json('order');

        $this->assertSame('không đá', $created['items'][0]['note']);

        // Update Coffee order with a new note
        $updated = $this->putJson("/api/v1/coffee/orders/{$created['id']}", [
            'version' => $created['version'],
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 2, 'note' => 'không đường']]
        ])->assertOk()->json('order');

        $this->assertSame('không đường', $updated['items'][0]['note']);
    }

    public function test_notifications_can_be_read_and_deleted_in_bulk(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);

        $employee->notifications()->create([
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'type' => 'App\Notifications\TestNotification',
            'data' => ['title' => 'Test 1', 'message' => 'Hello 1'],
            'read_at' => null,
        ]);
        $employee->notifications()->create([
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'type' => 'App\Notifications\TestNotification',
            'data' => ['title' => 'Test 2', 'message' => 'Hello 2'],
            'read_at' => null,
        ]);

        $this->actingAs($employee);

        $this->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonPath('unread_count', 2);

        $this->getJson('/api/v1/notifications?unread=1')->assertOk()
            ->assertJsonCount(2, 'notifications');

        $this->postJson('/api/v1/notifications/read-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonPath('unread_count', 0);
        $this->getJson('/api/v1/notifications?unread=1')->assertOk()
            ->assertJsonCount(0, 'notifications');

        $this->postJson('/api/v1/notifications/delete-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonCount(0, 'notifications');
    }

    public function test_notifications_can_be_paginated_and_filtered_by_category(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        foreach ([
            ['type' => 'coffee_order_created', 'title' => 'Đơn mới'],
            ['type' => 'coffee_payment_completed', 'title' => 'Thanh toán'],
            ['type' => 'fishing_session_expired', 'title' => 'Hết giờ'],
        ] as $payload) {
            $admin->notifications()->create([
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'type' => 'App\Notifications\TestNotification',
                'data' => ['type' => $payload['type'], 'title' => $payload['title'], 'message' => 'Test'],
                'read_at' => null,
            ]);
        }

        $this->actingAs($admin);

        $this->getJson('/api/v1/notifications?per_page=2')->assertOk()
            ->assertJsonCount(2, 'notifications')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('unread_count', 3);

        $this->getJson('/api/v1/notifications?category=payments')->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.data.type', 'coffee_payment_completed');

        $this->getJson('/api/v1/notifications?category=map')->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.data.type', 'fishing_session_expired');
    }

    public function test_pos_operational_day_resets_visibility_without_mutating_orders(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn 23']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê đen', 'price' => 20000, 'is_available' => true]);

        Carbon::setTestNow('2026-06-24 23:58:00');

        try {
            $created = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
                'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
            ])->assertCreated()->json('order');

            $this->getJson('/api/v1/coffee/map')
                ->assertOk()
                ->assertJsonPath('tables.0.state', 'occupied')
                ->assertJsonPath('stats.active_tables', 1)
                ->assertJsonPath('operational_day.resets_at', '2026-06-24T23:59:00+07:00');

            $this->getJson('/api/v1/orders')
                ->assertOk()
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('data.0.id', $created['id']);

            Carbon::setTestNow('2026-06-24 23:59:00');

            $this->getJson('/api/v1/coffee/map')
                ->assertOk()
                ->assertJsonPath('tables.0.state', 'available')
                ->assertJsonPath('stats.active_tables', 0)
                ->assertJsonPath('operational_day.starts_at', '2026-06-24T23:59:00+07:00')
                ->assertJsonPath('operational_day.resets_at', '2026-06-25T23:59:00+07:00');

            $this->getJson('/api/v1/orders')
                ->assertOk()
                ->assertJsonPath('meta.total', 0);
            $this->getJson("/api/v1/orders/{$created['id']}")
                ->assertNotFound();

            $storedOrder = Order::findOrFail($created['id']);
            $this->assertSame('open', $storedOrder->status);
            $this->assertNull($storedOrder->completed_at);

            $this->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
                'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1]],
            ])->assertCreated();

            $this->assertSame(2, Order::where('coffee_table_id', $table->id)->count());
            $this->getJson('/api/v1/coffee/map')
                ->assertOk()
                ->assertJsonPath('tables.0.state', 'occupied')
                ->assertJsonPath('stats.active_tables', 1);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_pos_operational_day_ignores_previous_fishing_session_for_new_day(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $spot = FishingSpot::create(['label' => 'Chòi 23']);

        Carbon::setTestNow('2026-06-24 23:58:00');

        try {
            $created = $this->actingAs($employee)
                ->postJson("/api/v1/fishing/spots/{$spot->id}/start")
                ->assertCreated()
                ->json('order');

            $this->getJson('/api/v1/fishing/map')
                ->assertOk()
                ->assertJsonPath('spots.0.state', 'occupied')
                ->assertJsonPath('stats.active_spots', 1);

            Carbon::setTestNow('2026-06-24 23:59:00');

            $this->getJson('/api/v1/fishing/map')
                ->assertOk()
                ->assertJsonPath('spots.0.state', 'available')
                ->assertJsonPath('stats.active_spots', 0);

            $storedOrder = Order::findOrFail($created['id']);
            $this->assertSame('open', $storedOrder->status);
            $this->assertNull($storedOrder->completed_at);
            $this->assertSame('active', $storedOrder->fishingSession->status);

            $this->postJson("/api/v1/fishing/spots/{$spot->id}/start")
                ->assertCreated();

            $this->assertSame(2, Order::where('fishing_spot_id', $spot->id)->count());
            $this->getJson('/api/v1/fishing/map')
                ->assertOk()
                ->assertJsonPath('spots.0.state', 'occupied')
                ->assertJsonPath('stats.active_spots', 1);
        } finally {
            Carbon::setTestNow();
        }
    }
}
