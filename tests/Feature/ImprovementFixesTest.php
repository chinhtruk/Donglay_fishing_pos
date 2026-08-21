<?php

namespace Tests\Feature;

use App\Models\CoffeeTable;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ImprovementFixesTest extends TestCase
{
    use RefreshDatabase;

    public function test_merge_preserves_comma_containing_notes_with_pipe_delimiter(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table1 = CoffeeTable::create(['label' => 'Bàn A']);
        $table2 = CoffeeTable::create(['label' => 'Bàn B']);
        $coffee = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê sữa', 'price' => 30000, 'is_available' => true]);

        // Order on table1 with note containing comma
        $order1 = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table1->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1, 'note' => 'ít đường, nhiều đá']],
        ])->assertCreated()->json('order');

        // Order on table2 with different note containing comma
        $order2 = $this->postJson("/api/v1/coffee/tables/{$table2->id}/orders", [
            'items' => [['menu_item_id' => $coffee->id, 'quantity' => 1, 'note' => 'không sữa, thêm topping']],
        ])->assertCreated()->json('order');

        $merged = $this->postJson("/api/v1/coffee/orders/{$order1['id']}/merge", [
            'version' => $order1['version'],
            'target_table_id' => $table2->id,
        ])->assertOk()->json('order');

        // Notes should be merged with " | " and not split on bare commas
        $mergedNote = collect($merged['items'])->first()['note'];
        $this->assertStringContainsString('ít đường, nhiều đá', $mergedNote);
        $this->assertStringContainsString('không sữa, thêm topping', $mergedNote);
        $this->assertStringContainsString(' | ', $mergedNote);
        // Should not create extra fragments by splitting on comma
        $this->assertSame(1, collect($merged['items'])->count());
    }

    public function test_backup_and_clear_requires_password_double_confirm(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'admin', 'email' => 'owner@example.com', 'password' => Hash::make('secret123')]);
        $this->actingAs($admin);

        // Missing password should fail
        $this->postJson('/api/v1/admin/data/backup-and-clear', [
            'confirmation' => 'BACKUP_AND_CLEAR',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        // Wrong password should fail
        $this->postJson('/api/v1/admin/data/backup-and-clear', [
            'confirmation' => 'BACKUP_AND_CLEAR',
            'password' => 'wrong',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        // Correct password but missing backup email still requires valid dump — mock it
        $base = tempnam(sys_get_temp_dir(), 'donglay-test-backup-');
        $path = $base.'.sql';
        rename($base, $path);
        file_put_contents($path, 'sql dump');
        $this->mock(\App\Services\DatabaseDumpWriter::class, function ($mock) use ($path): void {
            $mock->shouldReceive('createSqlDump')->once()->andReturn($path);
        });

        $this->postJson('/api/v1/admin/data/backup-and-clear', [
            'confirmation' => 'BACKUP_AND_CLEAR',
            'password' => 'secret123',
        ])->assertOk();
    }

    public function test_pos_notifications_are_queued_and_use_filtered_scope(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $employee = User::factory()->create(['role' => 'employee', 'is_active' => true]);
        $inactive = User::factory()->create(['role' => 'employee', 'is_active' => false]);
        $table = CoffeeTable::create(['label' => 'Bàn Notify']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Espresso', 'price' => 25000, 'is_available' => true]);

        $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated();

        // Only active admin/employee should have notification, inactive should not
        $this->assertCount(1, $admin->fresh()->notifications);
        $this->assertCount(1, $employee->fresh()->notifications);
        $this->assertCount(0, $inactive->fresh()->notifications);

        // Check notification class implements ShouldQueue
        $this->assertTrue(
            in_array(\Illuminate\Contracts\Queue\ShouldQueue::class, class_implements(\App\Notifications\PosEventNotification::class), true)
        );
    }

    public function test_coffee_and_fishing_maps_run_without_n1_query_explosion(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        // Create 5 tables and 5 spots with orders
        $tables = collect(range(1, 5))->map(fn ($i) => CoffeeTable::create(['label' => "Bàn $i"]));
        $spots = collect(range(1, 3))->map(fn ($i) => \App\Models\FishingSpot::create(['label' => "Chòi $i"]));
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Americano', 'price' => 30000, 'is_available' => true]);

        $this->actingAs($employee);
        foreach ($tables->take(3) as $table) {
            $this->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
                'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
            ])->assertCreated();
        }
        foreach ($spots->take(2) as $spot) {
            $this->postJson("/api/v1/fishing/spots/{$spot->id}/start")->assertCreated();
        }

        // Enable query logging and ensure map endpoints stay bounded (<20 queries)
        \Illuminate\Support\Facades\DB::enableQueryLog();
        $this->getJson('/api/v1/coffee/map')->assertOk();
        $coffeeQueries = count(\Illuminate\Support\Facades\DB::getQueryLog());
        \Illuminate\Support\Facades\DB::flushQueryLog();

        $this->getJson('/api/v1/fishing/map')->assertOk();
        $fishingQueries = count(\Illuminate\Support\Facades\DB::getQueryLog());
        \Illuminate\Support\Facades\DB::flushQueryLog();

        $this->assertLessThan(20, $coffeeQueries, "coffee/map should be eager-loaded, got $coffeeQueries queries");
        $this->assertLessThan(20, $fishingQueries, "fishing/map should be eager-loaded, got $fishingQueries queries");
    }
}
