import { renderLayout } from '../components/layout.js';
import { api } from '../utils/api.js';

export async function renderHome(router) {
  try {
    const response = await api.get('/api/pages/public');
    
    const content = `
      <div class="w-full min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-lime-50">
        <!-- Hero Section with Gradient Background -->
        <div class="relative pt-20 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <!-- Animated background elements -->
          <div class="absolute inset-0 overflow-hidden">
            <div class="absolute top-0 left-1/4 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
            <div class="absolute top-1/3 right-1/4 w-96 h-96 bg-lime-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
            <div class="absolute bottom-0 left-1/2 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          </div>

          <div class="max-w-6xl mx-auto relative z-10">
            <div class="text-center space-y-8">
              <div class="space-y-4">
                <h1 class="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-cyan-600 via-lime-600 to-yellow-600 bg-clip-text text-transparent">
                  Welcome to SecureApp
                </h1>
                <p class="text-xl sm:text-2xl text-slate-700 max-w-3xl mx-auto leading-relaxed">
                  ${response.data.description}
                </p>
              </div>

              <div class="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <a href="/login" data-navigo
                  class="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition shadow-lg hover:shadow-xl transform hover:scale-105">
                  Get Started
                </a>
                <a href="/about" data-navigo
                  class="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-lime-500 to-lime-600 text-white font-bold rounded-lg hover:from-lime-600 hover:to-lime-700 transition shadow-lg hover:shadow-xl transform hover:scale-105">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Features Section with Glass Cards -->
        <div class="py-20 px-4 sm:px-6 lg:px-8 relative">
          <div class="max-w-6xl mx-auto relative z-10">
            <div class="text-center mb-16">
              <h2 class="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-lime-600 bg-clip-text text-transparent mb-4">
                Powerful Features
              </h2>
              <p class="text-lg text-slate-600">
                Everything you need for secure business operations
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              ${response.data.features
                .map((feature, index) => `
                  <div class="group relative">
                    <div class="absolute inset-0 bg-gradient-to-r from-cyan-400 to-lime-400 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-300"></div>
                    <div class="relative bg-white/80 backdrop-blur-md rounded-xl p-8 border border-white/60 hover:border-cyan-300 transition shadow-lg hover:shadow-2xl">
                      <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-lime-500 text-white font-bold text-lg mb-4">
                        ${index + 1}
                      </div>
                      <h3 class="text-xl font-semibold text-slate-900 mb-3">
                        ${feature.split(':')[0] || feature}
                      </h3>
                      <p class="text-slate-600 leading-relaxed">
                        ${feature.split(':')[1] || feature}
                      </p>
                    </div>
                  </div>
                `)
                .join('')}
            </div>
          </div>
        </div>

        <!-- About Section with Glass Effect -->
        <div class="py-20 px-4 sm:px-6 lg:px-8 relative bg-gradient-to-b from-white/50 to-cyan-50/50">
          <div class="max-w-6xl mx-auto">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 class="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-lime-600 bg-clip-text text-transparent mb-6">
                  Built with Modern Technology
                </h2>
                <p class="text-lg text-slate-700 mb-8 leading-relaxed">
                  SecureApp is a Single Page Application engineered with cutting-edge technologies and security best practices to ensure your data remains protected.
                </p>
                
                <div class="space-y-4">
                  <div class="flex items-start gap-4 group">
                    <div class="flex-shrink-0">
                      <div class="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-cyan-500 to-cyan-600 text-white group-hover:shadow-lg transition">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-slate-900">Node.js & Express Backend</h3>
                      <p class="text-slate-600">Robust server-side architecture for reliable performance</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-4 group">
                    <div class="flex-shrink-0">
                      <div class="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-lime-500 to-lime-600 text-white group-hover:shadow-lg transition">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-slate-900">JWT Dual Token Authentication</h3>
                      <p class="text-slate-600">Secure access and refresh token mechanism</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-4 group">
                    <div class="flex-shrink-0">
                      <div class="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-yellow-500 to-yellow-600 text-white group-hover:shadow-lg transition">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-slate-900">HTTP-only Cookies</h3>
                      <p class="text-slate-600">Protected with SameSite and secure flags</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-4 group">
                    <div class="flex-shrink-0">
                      <div class="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-red-500 to-red-600 text-white group-hover:shadow-lg transition">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-slate-900">Advanced Security Headers</h3>
                      <p class="text-slate-600">CSP and XSS protection enabled by default</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-4 group">
                    <div class="flex-shrink-0">
                      <div class="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-cyan-500 to-lime-500 text-white group-hover:shadow-lg transition">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 class="text-lg font-semibold text-slate-900">Client-side Routing</h3>
                      <p class="text-slate-600">Fast navigation with Navigo.js router</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="relative">
                <!-- Glass effect background -->
                <div class="absolute inset-0 bg-gradient-to-br from-cyan-300/30 to-lime-300/30 rounded-2xl blur-xl"></div>
                
                <div class="relative bg-white/70 backdrop-blur-lg rounded-2xl p-12 border border-white/80 shadow-2xl">
                  <div class="space-y-6">
                    <div class="bg-gradient-to-br from-cyan-50 to-cyan-100 backdrop-blur-md rounded-lg p-6 shadow-md border border-cyan-200/50 hover:shadow-lg transition">
                      <div class="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-700 bg-clip-text text-transparent mb-2">100%</div>
                      <p class="text-slate-700 font-medium">Secure by Default</p>
                    </div>
                    <div class="bg-gradient-to-br from-lime-50 to-lime-100 backdrop-blur-md rounded-lg p-6 shadow-md border border-lime-200/50 hover:shadow-lg transition">
                      <div class="text-3xl font-bold bg-gradient-to-r from-lime-600 to-lime-700 bg-clip-text text-transparent mb-2">24/7</div>
                      <p class="text-slate-700 font-medium">Automatic Token Refresh</p>
                    </div>
                    <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 backdrop-blur-md rounded-lg p-6 shadow-md border border-yellow-200/50 hover:shadow-lg transition">
                      <div class="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-700 bg-clip-text text-transparent mb-2">∞</div>
                      <p class="text-slate-700 font-medium">Scalable Architecture</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- CTA Section with Glass Effect -->
        <div class="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-gradient-to-r from-cyan-100 via-lime-100 to-yellow-100">
          <!-- Animated background -->
          <div class="absolute inset-0 opacity-40">
            <div class="absolute top-0 left-0 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div class="absolute bottom-0 right-0 w-96 h-96 bg-lime-300 rounded-full mix-blend-multiply filter blur-3xl"></div>
          </div>

          <div class="max-w-4xl mx-auto text-center relative z-10">
            <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-12 border border-white/80 shadow-2xl">
              <h2 class="text-4xl font-bold bg-gradient-to-r from-cyan-600 via-lime-600 to-yellow-600 bg-clip-text text-transparent mb-6">
                Ready to Get Started?
              </h2>
              <p class="text-xl text-slate-700 mb-8">
                Join thousands of users who trust SecureApp for their business operations
              </p>
              <a href="/login" data-navigo
                class="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-cyan-500 to-lime-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-lime-600 transition shadow-lg hover:shadow-xl transform hover:scale-105">
                Start Your Journey
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    
    renderLayout(content, router);

  } catch (error) {
    const content = `
      <div class="w-full min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-lime-50">
        <div class="relative pt-20 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="absolute top-0 left-1/4 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
            <div class="absolute top-1/3 right-1/4 w-96 h-96 bg-lime-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          </div>

          <div class="max-w-4xl mx-auto text-center space-y-6 relative z-10">
            <h1 class="text-5xl font-bold bg-gradient-to-r from-cyan-600 to-lime-600 bg-clip-text text-transparent">
              Welcome to SecureApp
            </h1>

            <div class="bg-red-100/80 backdrop-blur-lg border border-red-300/60 text-red-800 px-6 py-4 rounded-lg">
              <p class="font-semibold">Failed to load page data</p>
              <p class="text-sm mt-2">Please try again or contact support</p>
            </div>

            <a href="/login" data-navigo
              class="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition shadow-lg">
              Get Started
            </a>
          </div>
        </div>
      </div>
    `;

    renderLayout(content, router);
  }
}
