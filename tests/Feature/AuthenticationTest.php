<?php

namespace Tests\Feature;

use App\Mail\EmployeeOtpMail;
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
        $employee = User::factory()->create(['username' => 'nhanvien01', 'email' => 'staff@example.com', 'password' => null, 'role' => 'employee']);
        $this->postJson('/api/v1/auth/otp/request', ['username' => ' NHANVIEN01 '])->assertOk();
        Mail::assertQueued(EmployeeOtpMail::class, fn (EmployeeOtpMail $mail) => $mail->hasTo($employee->email));
        $challenge = $employee->otpChallenges()->latest()->firstOrFail();
        $challenge->update(['code_hash' => Hash::make('123456')]);
        $this->postJson('/api/v1/auth/otp/verify', ['username' => 'NHANVIEN01', 'code' => '123456'])
            ->assertOk()->assertJsonPath('redirect', '/pos/coffee');
        $this->assertAuthenticatedAs($employee);
        $this->postJson('/api/v1/auth/otp/verify', ['username' => 'nhanvien01', 'code' => '123456'])->assertUnprocessable();
    }

    public function test_employee_otp_request_does_not_accept_email_as_the_login_identifier(): void
    {
        Mail::fake();
        $employee = User::factory()->create(['username' => 'nhanvien02', 'email' => 'staff2@example.com', 'role' => 'employee']);

        $this->postJson('/api/v1/auth/otp/request', ['email' => $employee->email])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('username');

        Mail::assertNothingQueued();
        $this->assertDatabaseCount('otp_challenges', 0);
    }

    public function test_admin_can_create_employee_with_username_and_linked_email(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)->postJson('/api/v1/admin/users', [
            'name' => 'Nhân viên mới',
            'username' => ' NhanVien.Moi ',
            'email' => ' Staff.New@Example.com ',
            'email_verified' => true,
            'role' => 'employee',
            'is_active' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.username', 'nhanvien.moi')
            ->assertJsonPath('user.email', 'staff.new@example.com');
        $this->assertDatabaseHas('users', [
            'username' => 'nhanvien.moi',
            'email' => 'staff.new@example.com',
            'role' => 'employee',
        ]);
    }

    public function test_disabled_user_cannot_login(): void
    {
        User::factory()->create(['username' => 'quiet', 'password' => 'Secret123!', 'role' => 'admin', 'is_active' => false]);
        $this->postJson('/api/v1/auth/admin', ['username' => 'quiet', 'password' => 'Secret123!'])->assertUnprocessable();
    }
}
