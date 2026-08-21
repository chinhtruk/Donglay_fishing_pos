<?php

namespace Tests\Feature;

use App\Mail\DatabaseBackupMail;
use App\Models\CoffeeTable;
use App\Models\MenuItem;
use App\Models\User;
use App\Services\AdminDataManagementService;
use App\Services\DatabaseDumpWriter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Mockery\MockInterface;
use Tests\TestCase;

class AdminDataManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_email_a_backup_without_clearing_operational_data(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'admin', 'email' => 'owner@example.com']);
        $table = CoffeeTable::create(['label' => 'Bàn sao lưu']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê backup', 'price' => 25000, 'is_available' => true]);
        $order = $this->actingAs($admin)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');
        $backupPath = $this->fakeDatabaseDump();

        $this->get('/admin/data')
            ->assertOk()
            ->assertSee('/admin/data', false);

        $this->getJson('/api/v1/admin/payment-settings')
            ->assertOk()
            ->assertJsonMissingPath('data_management');

        $this->getJson('/api/v1/admin/data')
            ->assertOk()
            ->assertJsonPath('backup_email', 'owner@example.com')
            ->assertJsonPath('can_backup', true);

        $this->postJson('/api/v1/admin/data/backup')
            ->assertOk()
            ->assertJsonPath('message', 'Bản sao lưu đã được gửi đến owner@example.com. File tạm trên server đã được xóa.');

        Mail::assertSent(DatabaseBackupMail::class, fn (DatabaseBackupMail $mail) => $mail->hasTo('owner@example.com')
            && ! $mail->beforeReset
            && str_ends_with($mail->backupName, '.sql')
            && ! str_ends_with($mail->backupName, '.sql.gz'));
        $this->assertDatabaseHas('orders', ['id' => $order['id']]);
        $this->assertFileDoesNotExist($backupPath);
    }

    public function test_backup_and_clear_requires_confirmation_then_only_deletes_operational_data(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'admin', 'email' => 'owner@example.com', 'password' => \Illuminate\Support\Facades\Hash::make('secret123')]);
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn giữ lại']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê giữ lại', 'price' => 30000, 'is_available' => true]);
        $order = $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()->json('order');
        $this->postJson("/api/v1/coffee/orders/{$order['id']}/checkout", [
            'version' => $order['version'],
            'cash_received' => 30000,
        ])->assertOk();
        $employee->otpChallenges()->create([
            'code_hash' => 'hash',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->actingAs($admin)->postJson('/api/v1/admin/data/backup-and-clear')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('confirmation');
        $this->assertDatabaseCount('orders', 1);

        $backupPath = $this->fakeDatabaseDump();
        $this->postJson('/api/v1/admin/data/backup-and-clear', [
            'confirmation' => 'BACKUP_AND_CLEAR',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('message', 'Đã gửi bản sao lưu đến owner@example.com và xóa dữ liệu vận hành.');

        Mail::assertSent(DatabaseBackupMail::class, fn (DatabaseBackupMail $mail) => $mail->hasTo('owner@example.com') && $mail->beforeReset);
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('payment_lines', 0);
        $this->assertDatabaseCount('otp_challenges', 0);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('users', ['id' => $employee->id]);
        $this->assertDatabaseHas('coffee_tables', ['id' => $table->id]);
        $this->assertDatabaseHas('menu_items', ['id' => $item->id]);
        $this->assertFileDoesNotExist($backupPath);
        $this->assertAuthenticatedAs($admin);
    }

    public function test_admin_without_linked_email_cannot_start_a_backup(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => 'admin', 'email' => null]);

        $this->actingAs($admin)->postJson('/api/v1/admin/data/backup')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        Mail::assertNothingSent();
    }

    public function test_pos_writes_are_blocked_while_operational_data_is_being_reset(): void
    {
        $employee = User::factory()->create(['role' => 'employee']);
        $table = CoffeeTable::create(['label' => 'Bàn đang bảo trì']);
        $item = MenuItem::create(['category' => 'Cà phê', 'name' => 'Cà phê bảo trì', 'price' => 20000, 'is_available' => true]);
        Cache::put(AdminDataManagementService::RESET_FLAG, true, now()->addMinute());

        try {
            $this->actingAs($employee)->postJson("/api/v1/coffee/tables/{$table->id}/orders", [
                'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
            ])->assertServiceUnavailable();
        } finally {
            Cache::forget(AdminDataManagementService::RESET_FLAG);
        }

        $this->assertDatabaseCount('orders', 0);
    }

    private function fakeDatabaseDump(): string
    {
        $basePath = tempnam(sys_get_temp_dir(), 'donglay-test-backup-');
        $path = $basePath.'.sql';
        rename($basePath, $path);
        file_put_contents($path, 'sql dump');
        $this->mock(DatabaseDumpWriter::class, function (MockInterface $mock) use ($path): void {
            $mock->shouldReceive('createSqlDump')->once()->andReturn($path);
        });

        return $path;
    }
}
