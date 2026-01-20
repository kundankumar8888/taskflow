import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { organizationAPI } from '@/utils/api';
import { Plus, Building2, Users, LogOut, Settings } from 'lucide-react';

const Dashboard = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await organizationAPI.getAll();
      setOrganizations(response.data);
    } catch (error) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = { name: formData.get('name') };

    try {
      await organizationAPI.create(data);
      toast.success('Organization created successfully!');
      setCreateDialogOpen(false);
      fetchOrganizations();
      e.target.reset();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create organization');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/auth');
    toast.success('Logged out successfully');
  };

  return (
    <div className="dashboard-container" data-testid="dashboard-page">
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TaskFlow
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.full_name}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin')}
                data-testid="admin-button"
              >
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Your Organizations</h2>
              <p className="text-muted-foreground mt-1">Manage your teams and projects</p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-org-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="create-org-dialog">
                <DialogHeader>
                  <DialogTitle>Create New Organization</DialogTitle>
                  <DialogDescription>
                    Create a new organization to manage your team and tasks
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      name="name"
                      placeholder="My Company"
                      required
                      data-testid="org-name-input"
                    />
                  </div>
                  <Button type="submit" className="w-full" data-testid="create-org-submit">
                    Create Organization
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading organizations...</p>
            </div>
          ) : organizations.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Organizations Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first organization to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="organizations-list">
              {organizations.map((org) => (
                <Card
                  key={org.id}
                  className="glass-card cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => navigate(`/organization/${org.id}`)}
                  data-testid={`org-card-${org.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{org.name}</CardTitle>
                        <CardDescription>
                          <span className={`status-badge ${
                            org.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {org.subscription_status === 'active' ? 'Active' : 'Free'}
                          </span>
                        </CardDescription>
                      </div>
                      <Building2 className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;