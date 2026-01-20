import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { organizationAPI, paymentAPI } from '@/utils/api';
import { ArrowLeft, Users, Plus, ListChecks, CreditCard, TrendingUp, CheckCircle2, Clock } from 'lucide-react';

const OrganizationPage = ({ user }) => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('starter');

  useEffect(() => {
    fetchData();
  }, [orgId]);

  const fetchData = async () => {
    try {
      const [orgRes, membersRes, statsRes] = await Promise.all([
        organizationAPI.getOne(orgId),
        organizationAPI.getMembers(orgId),
        organizationAPI.getStats(orgId),
      ]);
      setOrganization(orgRes.data);
      setMembers(membersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      role: formData.get('role'),
    };

    try {
      await organizationAPI.invite(orgId, data);
      toast.success('Member invited successfully!');
      setInviteDialogOpen(false);
      fetchData();
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to invite member');
    }
  };

  const handleUpgrade = async () => {
    try {
      const response = await paymentAPI.createCheckout({
        package_id: selectedPackage,
        org_id: orgId,
      });
      window.location.href = response.data.url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create checkout session');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const packages = [
    { id: 'starter', name: 'Starter', price: '$29', features: ['Up to 10 users', 'Basic task management', 'Email support'] },
    { id: 'professional', name: 'Professional', price: '$79', features: ['Up to 50 users', 'Advanced features', 'Priority support'] },
    { id: 'enterprise', name: 'Enterprise', price: '$199', features: ['Unlimited users', 'All features', '24/7 support'] },
  ];

  return (
    <div className="dashboard-container" data-testid="organization-page">
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} data-testid="back-button">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{organization?.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats?.members_count} members • {stats?.total_tasks} tasks
                </p>
              </div>
            </div>
            <Button onClick={() => navigate(`/organization/${orgId}/tasks`)} data-testid="view-tasks-button">
              <ListChecks className="h-4 w-4 mr-2" />
              View Tasks
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total_tasks || 0}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats?.pending_tasks || 0}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats?.in_progress_tasks || 0}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats?.completed_tasks || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage your organization members</CardDescription>
                </div>
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="invite-member-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="invite-member-dialog">
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Invite a user to join your organization
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="member-email">Email</Label>
                        <Input
                          id="member-email"
                          name="email"
                          type="email"
                          placeholder="colleague@example.com"
                          required
                          data-testid="member-email-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="member-role">Role</Label>
                        <Select name="role" defaultValue="employee" required>
                          <SelectTrigger data-testid="member-role-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full" data-testid="invite-submit-button">
                        Send Invitation
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="members-list">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`member-${member.id}`}>
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <span className={`role-badge role-${member.role}`}>
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>Upgrade your plan for more features</CardDescription>
                </div>
                <span className={`status-badge ${
                  organization?.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {organization?.subscription_status === 'active' ? 'Active' : 'Free'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {organization?.subscription_status !== 'active' ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upgrade to unlock advanced features and support
                  </p>
                  <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" data-testid="upgrade-button">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Upgrade Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl" data-testid="payment-dialog">
                      <DialogHeader>
                        <DialogTitle>Choose Your Plan</DialogTitle>
                        <DialogDescription>
                          Select the plan that best fits your needs
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 md:grid-cols-3 mt-4">
                        {packages.map((pkg) => (
                          <Card
                            key={pkg.id}
                            className={`cursor-pointer transition-all ${
                              selectedPackage === pkg.id ? 'ring-2 ring-blue-600' : ''
                            }`}
                            onClick={() => setSelectedPackage(pkg.id)}
                            data-testid={`package-${pkg.id}`}
                          >
                            <CardHeader>
                              <CardTitle className="text-lg">{pkg.name}</CardTitle>
                              <CardDescription className="text-2xl font-bold">{pkg.price}/mo</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {pkg.features.map((feature, idx) => (
                                  <li key={idx} className="flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <Button onClick={handleUpgrade} className="w-full mt-4" data-testid="proceed-to-payment-button">
                        Proceed to Payment
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">You have an active subscription</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Thank you for being a premium member! Enjoy all the advanced features.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OrganizationPage;