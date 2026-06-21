<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_login_with_username_and_password(): void
    {
        $admin = User::factory()->create(['username' => 'admin', 'email' => 'admin@example.com', 'password' => 'Secret123!', 'role' => 'admin']);
        $this->postJson('/api/v1/auth/admin', ['username' => 'admin', 'password' => 'Secret123!'])
            ->assertOk()->assertJsonPath('redirect', '/admin/dashboard');
        $this->assertAuthenticatedAs($admin);
    }

    public function test_employee_otp_is_single_use_and_logs_employee_in(): void
    {
        Mail::fake();
        $employee = User::factory()->create(['email' => 'staff@example.com', 'password' => null, 'role' => 'employee']);
        $this->postJson('/api/v1/auth/otp/request', ['email' => $employee->email])->assertOk();
        $challenge = $employee->otpChallenges()->latest()->firstOrFail();
        $challenge->update(['code_hash' => Hash::make('123456')]);
        $this->postJson('/api/v1/auth/otp/verify', ['email' => $employee->email, 'code' => '123456'])
            ->assertOk()->assertJsonPath('redirect', '/pos/coffee');
        $this->assertAuthenticatedAs($employee);
        $this->postJson('/api/v1/auth/otp/verify', ['email' => $employee->email, 'code' => '123456'])->assertUnprocessable();
    }

    public function test_disabled_user_cannot_login(): void
    {
        User::factory()->create(['username' => 'quiet', 'password' => 'Secret123!', 'role' => 'admin', 'is_active' => false]);
        $this->postJson('/api/v1/auth/admin', ['username' => 'quiet', 'password' => 'Secret123!'])->assertUnprocessable();
    }
}
