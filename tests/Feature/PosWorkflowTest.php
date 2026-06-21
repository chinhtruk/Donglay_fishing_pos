<?php

namespace Tests\Feature;

use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Http\UploadedFile;
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

        $this->postJson('/api/v1/notifications/read-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->postJson('/api/v1/notifications/delete-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonCount(0, 'notifications');
    }
}
