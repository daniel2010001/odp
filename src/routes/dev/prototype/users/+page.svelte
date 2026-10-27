<!--
	Maqueta — Administración de usuarios (superadministrador). PRD RF-01..RF-03.

	Pantalla sin funcionamiento, con datos de ejemplo: muestra cómo el portal creará cuentas y asignará
	organizaciones y roles, tareas que hoy se hacen desde la interfaz nativa de CKAN. `?vista=nuevo` abre el
	formulario de alta, para capturar ese estado por separado.

	Sólo hay usuarios activos (Q5, decidida el 2026-10-26): los bloqueados, su estado y su filtro quedan para la
	implementación.

	Modelo de CKAN (medido, ver `design-system/datos-umss/preguntas-abiertas.md`): un usuario es miembro de
	**varias** organizaciones con **un rol en cada una** (`member` → «Lector», `editor`, `admin`); el
	superadministrador es una marca de la cuenta (`sysadmin`), no un rol de organización. El alta nativa es
	una invitación por correo (`user_invite`, Q9).
-->
<script lang="ts">
import { MoreHorizontal, Plus, Search, ShieldCheck, UserPlus, Users, X } from "@lucide/svelte";
import { get } from "svelte/store";
import { page } from "$app/stores";
import Breadcrumb from "$lib/components/ui/breadcrumb/Breadcrumb.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";

type Role = "Lector" | "Editor" | "Administrador";

interface Membership {
	org: string;
	role: Role;
}

interface MockUser {
	name: string;
	email: string;
	memberships: Membership[];
	sysadmin?: boolean;
	lastSeen: string;
}

const USERS: MockUser[] = [
	{
		name: "María Fernanda Rojas Vargas",
		email: "mf.rojas@umss.edu.bo",
		memberships: [
			{ org: "Dirección de Investigación", role: "Administrador" },
			{ org: "Facultad de Ciencias y Tecnología", role: "Lector" },
		],
		lastSeen: "Hoy, 09:42",
	},
	{
		name: "Jorge Luis Mamani Quispe",
		email: "jl.mamani@umss.edu.bo",
		memberships: [{ org: "Facultad de Ciencias y Tecnología", role: "Editor" }],
		lastSeen: "Ayer",
	},
	{
		name: "Ana Gabriela Céspedes",
		email: "a.cespedes@umss.edu.bo",
		memberships: [
			{ org: "Facultad de Ciencias de la Salud", role: "Editor" },
			{ org: "Dirección de Investigación", role: "Editor" },
		],
		lastSeen: "Hace 3 días",
	},
	{
		name: "Carlos Eduardo Villarroel",
		email: "c.villarroel@umss.edu.bo",
		memberships: [{ org: "Rectorado UMSS", role: "Administrador" }],
		sysadmin: true,
		lastSeen: "Hoy, 08:15",
	},
	{
		name: "Lucía Andrea Torrico",
		email: "l.torrico@umss.edu.bo",
		memberships: [{ org: "Facultad de Ciencias Agrícolas", role: "Lector" }],
		lastSeen: "Hace 1 semana",
	},
	{
		name: "Rodrigo Antezana Flores",
		email: "r.antezana@umss.edu.bo",
		memberships: [
			{ org: "Facultad de Ciencias y Tecnología", role: "Administrador" },
			{ org: "Facultad de Ciencias Agrícolas", role: "Lector" },
			{ org: "Dirección de Investigación", role: "Lector" },
		],
		lastSeen: "Hace 2 días",
	},
	{
		name: "Patricia Soliz Herrera",
		email: "p.soliz@umss.edu.bo",
		memberships: [{ org: "Facultad de Ciencias de la Salud", role: "Editor" }],
		lastSeen: "Hace 4 meses",
	},
	{
		name: "Diego Alejandro Paz",
		email: "d.paz@umss.edu.bo",
		memberships: [],
		lastSeen: "Hace 5 días",
	},
];

const ORGS = [
	"Dirección de Investigación",
	"Facultad de Ciencias Agrícolas",
	"Facultad de Ciencias de la Salud",
	"Facultad de Ciencias y Tecnología",
	"Rectorado UMSS",
];
const ROLES: Role[] = ["Lector", "Editor", "Administrador"];

/** Sigla de cada organización, para que una fila con varias membresías no se parta en tres líneas. */
const ORG_SHORT: Record<string, string> = {
	"Dirección de Investigación": "DICyT",
	"Facultad de Ciencias Agrícolas": "FCAPyF",
	"Facultad de Ciencias de la Salud": "FCS",
	"Facultad de Ciencias y Tecnología": "FCyT",
	"Rectorado UMSS": "Rectorado",
};

/** Cuántas organizaciones se muestran antes de resumir el resto en «+N». */
const VISIBLE_MEMBERSHIPS = 2;

let creating = $state(get(page).url.searchParams.get("vista") === "nuevo");

function initials(name: string): string {
	return name
		.split(" ")
		.slice(0, 2)
		.map((part) => part[0])
		.join("");
}

const selectClass =
	"h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const inputClass =
	"h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
</script>

<svelte:head>
	<title>Usuarios — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		<Breadcrumb items={[{ label: "Panel", href: "/dashboard" }, { label: "Usuarios" }]} icon={Users} />

		<header class="mt-5 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="font-heading text-3xl font-bold text-primary sm:text-4xl">Usuarios</h1>
				<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
					Cree las cuentas de la plataforma y asigne a cada persona su organización y su rol.
				</p>
			</div>
			<Button onclick={() => (creating = true)}>
				<UserPlus class="size-4" aria-hidden="true" />
				Nuevo usuario
			</Button>
		</header>

		<Card class="mt-6 p-5">
			<div class="flex flex-wrap items-center gap-3">
				<label class="relative min-w-64 flex-1">
					<span class="sr-only">Buscar usuarios</span>
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input class="{inputClass} pl-9" placeholder="Buscar por nombre o correo" />
				</label>
				<select class={selectClass} aria-label="Organización">
					<option>Todas las organizaciones</option>
					{#each ORGS as org (org)}
						<option>{org}</option>
					{/each}
				</select>
				<select class={selectClass} aria-label="Rol">
					<option>Todos los roles</option>
					<option>Superadministrador</option>
					{#each ROLES as role (role)}
						<option>{role}</option>
					{/each}
				</select>
			</div>

			<div class="mt-5 overflow-x-auto">
				<table class="w-full min-w-[52rem] text-left text-sm">
					<thead class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
						<tr>
							<th class="py-3 pr-4 font-medium">Usuario</th>
							<th class="py-3 pr-4 font-medium">Organizaciones y rol</th>
							<th class="py-3 pr-4 font-medium">Último acceso</th>
							<th class="py-3 font-medium"><span class="sr-only">Acciones</span></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each USERS as user (user.email)}
							<tr>
								<td class="py-3 pr-4">
									<div class="flex items-center gap-3">
										<span
											class="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
											aria-hidden="true">{initials(user.name)}</span
										>
										<div>
											<p class="flex items-center gap-1.5 font-medium text-primary">
												{user.name}
												{#if user.sysadmin}
													<span
														class="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
													>
														<ShieldCheck class="size-3" aria-hidden="true" />
														Superadministrador
													</span>
												{/if}
											</p>
											<p class="font-mono text-xs text-muted-foreground">{user.email}</p>
										</div>
									</div>
								</td>
								<td class="py-3 pr-4">
									{#if user.memberships.length === 0}
										<span class="text-muted-foreground">Sin organización</span>
									{:else}
										<ul class="flex flex-wrap gap-1.5">
											{#each user.memberships.slice(0, VISIBLE_MEMBERSHIPS) as membership (membership.org)}
												<li
													class="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground"
													title={membership.org}
												>
													<span class="font-semibold">{ORG_SHORT[membership.org]}</span>
													<span class="text-muted-foreground">· {membership.role}</span>
												</li>
											{/each}
											{#if user.memberships.length > VISIBLE_MEMBERSHIPS}
												<li class="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
													+{user.memberships.length - VISIBLE_MEMBERSHIPS}
												</li>
											{/if}
										</ul>
									{/if}
								</td>
								<td class="py-3 pr-4 text-muted-foreground">{user.lastSeen}</td>
								<td class="py-3 text-right">
									<button
										class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
										aria-label="Acciones para {user.name}"
									>
										<MoreHorizontal class="size-4" aria-hidden="true" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
				<p>Mostrando 1–8 de 128 usuarios</p>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" disabled>Anterior</Button>
					<Button variant="outline" size="sm">Siguiente</Button>
				</div>
			</div>
		</Card>
	</div>
</div>

{#if creating}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
		<div
			class="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg"
			role="dialog"
			aria-modal="true"
			aria-labelledby="new-user-title"
		>
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 id="new-user-title" class="font-heading text-2xl font-semibold text-primary">
						Nuevo usuario
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						La persona recibirá una invitación por correo para definir su contraseña.
					</p>
				</div>
				<button
					class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
					aria-label="Cerrar"
					onclick={() => (creating = false)}
				>
					<X class="size-4" aria-hidden="true" />
				</button>
			</div>

			<form class="mt-6 space-y-4" onsubmit={(event) => event.preventDefault()}>
				<label class="block space-y-1.5">
					<span class="text-sm font-medium text-primary">Nombre completo</span>
					<input class={inputClass} value="Valeria Montaño Ríos" />
				</label>
				<label class="block space-y-1.5">
					<span class="text-sm font-medium text-primary">Correo institucional</span>
					<input class={inputClass} type="email" value="v.montano@umss.edu.bo" />
				</label>
				<fieldset class="space-y-2">
					<legend class="text-sm font-medium text-primary">Organizaciones y rol</legend>
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="block space-y-1.5">
							<span class="text-xs text-muted-foreground">Organización</span>
							<select class="{selectClass} w-full">
								{#each ORGS as org (org)}
									<option selected={org === "Facultad de Ciencias y Tecnología"}>{org}</option>
								{/each}
							</select>
						</label>
						<label class="block space-y-1.5">
							<span class="text-xs text-muted-foreground">Rol</span>
							<select class="{selectClass} w-full">
								{#each ROLES as role (role)}
									<option selected={role === "Editor"}>{role}</option>
								{/each}
							</select>
						</label>
					</div>
					<button
						type="button"
						class="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						<Plus class="size-4" aria-hidden="true" />
						Agregar otra organización
					</button>
				</fieldset>
				<p class="rounded-lg bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground">
					Cada rol vale sólo en su organización. Los permisos sobre un dataset concreto se asignan
					después, desde sus colaboradores.
				</p>
				<label class="flex items-start gap-2 text-sm text-foreground">
					<input type="checkbox" class="mt-0.5 size-4 accent-primary" />
					<span>
						Superadministrador
						<span class="block text-xs text-muted-foreground">
							Acceso total a la plataforma, en todas las organizaciones.
						</span>
					</span>
				</label>
				<div class="flex justify-end gap-2 pt-2">
					<Button variant="outline" type="button" onclick={() => (creating = false)}>
						Cancelar
					</Button>
					<Button type="submit">Enviar invitación</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
