'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import * as API from '@/lib/api';
import * as Types from '@/lib/types';

export default function PersonaTab() {
  const [personas, setPersonas] = useState<Types.AudiencePersona | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      const data = await API.PersonaAPI.get();
      setPersonas(data);
    } catch (error) {
      console.error('Failed to load personas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Audience Personas</CardTitle>
            <CardDescription>Define your target audience and sub-personas with their pain points and goals</CardDescription>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="primary">
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {personas && (
            <>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-lg mb-4">
                    Main Persona: {personas.mainPersona.name}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pain Points</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {personas.mainPersona.painPoints.map((point) => (
                          <span
                            key={point}
                            className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Goals</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {personas.mainPersona.goals.map((goal) => (
                          <span
                            key={goal}
                            className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm"
                          >
                            {goal}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Behaviors</p>
                      <ul className="mt-2 space-y-1">
                        {personas.mainPersona.behaviors.map((behavior) => (
                          <li key={behavior} className="text-gray-600 dark:text-gray-400 text-sm">
                            • {behavior}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {personas.subPersonas.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Sub-Personas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {personas.subPersonas.map((persona) => (
                      <div
                        key={persona.id}
                        className="border border-gray-200 dark:border-gray-800 rounded-lg p-4"
                      >
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-3">
                          {persona.name}
                        </h5>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Pain Points
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {persona.painPoints.map((point) => (
                                <span
                                  key={point}
                                  className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs"
                                >
                                  {point}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Goals
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {persona.goals.map((goal) => (
                                <span
                                  key={goal}
                                  className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs"
                                >
                                  {goal}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
